"""Finalize the reduced PLA casting-pattern mesh for browser delivery.

This script keeps the simplified geometry and transform from the intermediate
glTF-Transform output, removes source textures that are not used by the site's
procedural PLA material, and rebuilds smooth vertex normals. The source GLB is
never modified.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "models" / "plakingforwebsite-reduced.glb"
OUTPUT = ROOT / "models" / "plakingforwebsite-web.glb"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise ValueError("Input is not a valid glTF 2.0 binary file.")

    document = None
    binary = None
    offset = 12
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + length]
        offset += length
        if chunk_type == JSON_CHUNK:
            document = json.loads(payload.rstrip(b" \t\r\n\0").decode("utf-8"))
        elif chunk_type == BIN_CHUNK:
            binary = payload

    if document is None or binary is None:
        raise ValueError("Input GLB must contain JSON and BIN chunks.")
    return document, binary


def read_positions(document: dict, binary: bytes, accessor_index: int) -> list[tuple[float, float, float]]:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    if accessor["componentType"] != 5122 or accessor["type"] != "VEC3":
        raise ValueError("Expected normalized signed-short VEC3 positions.")

    stride = view.get("byteStride", 6)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    values = []
    for index in range(accessor["count"]):
        raw = struct.unpack_from("<hhh", binary, start + index * stride)
        values.append(tuple(max(value / 32767, -1) for value in raw))
    return values


def read_indices(document: dict, binary: bytes, accessor_index: int) -> tuple[list[int], int]:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4)}
    if accessor["componentType"] not in formats or accessor["type"] != "SCALAR":
        raise ValueError("Expected unsigned scalar triangle indices.")

    component_format, component_size = formats[accessor["componentType"]]
    stride = view.get("byteStride", component_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    values = [
        struct.unpack_from("<" + component_format, binary, start + index * stride)[0]
        for index in range(accessor["count"])
    ]
    return values, accessor["componentType"]


def build_normals(positions: list[tuple[float, float, float]], indices: list[int]) -> bytes:
    normal_sums = [0.0] * (len(positions) * 3)
    for offset in range(0, len(indices), 3):
        ia, ib, ic = indices[offset : offset + 3]
        ax, ay, az = positions[ia]
        bx, by, bz = positions[ib]
        cx, cy, cz = positions[ic]
        abx, aby, abz = bx - ax, by - ay, bz - az
        acx, acy, acz = cx - ax, cy - ay, cz - az
        nx = aby * acz - abz * acy
        ny = abz * acx - abx * acz
        nz = abx * acy - aby * acx
        for vertex_index in (ia, ib, ic):
            base = vertex_index * 3
            normal_sums[base] += nx
            normal_sums[base + 1] += ny
            normal_sums[base + 2] += nz

    payload = bytearray(len(positions) * 8)
    for index in range(len(positions)):
        base = index * 3
        nx, ny, nz = normal_sums[base : base + 3]
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        if length <= 1e-12:
            nx, ny, nz = 0.0, 1.0, 0.0
        else:
            nx, ny, nz = nx / length, ny / length, nz / length
        struct.pack_into(
            "<hhh",
            payload,
            index * 8,
            round(max(-1, min(1, nx)) * 32767),
            round(max(-1, min(1, ny)) * 32767),
            round(max(-1, min(1, nz)) * 32767),
        )
    return bytes(payload)


def pack_positions(document: dict, binary: bytes, accessor_index: int) -> bytes:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    stride = view.get("byteStride", 6)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    payload = bytearray(accessor["count"] * 8)
    for index in range(accessor["count"]):
        source_offset = start + index * stride
        payload[index * 8 : index * 8 + 6] = binary[source_offset : source_offset + 6]
    return bytes(payload)


def pack_indices(document: dict, binary: bytes, accessor_index: int) -> bytes:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    component_size = {5121: 1, 5123: 2, 5125: 4}[accessor["componentType"]]
    byte_length = accessor["count"] * component_size
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return binary[start : start + byte_length]


def align_four(payload: bytearray) -> None:
    while len(payload) % 4:
        payload.append(0)


def write_glb(
    document: dict,
    payloads: list[tuple[bytes, int, int | None]],
    output: Path,
) -> None:
    binary = bytearray()
    views = []
    for payload, target, stride in payloads:
        align_four(binary)
        view = {
            "buffer": 0,
            "byteOffset": len(binary),
            "byteLength": len(payload),
            "target": target,
        }
        if stride is not None:
            view["byteStride"] = stride
        views.append(view)
        binary.extend(payload)
    align_four(binary)

    document["bufferViews"] = views
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "

    total_length = 12 + 8 + len(json_bytes) + 8 + len(binary)
    output_bytes = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    output_bytes.extend(struct.pack("<II", len(json_bytes), JSON_CHUNK))
    output_bytes.extend(json_bytes)
    output_bytes.extend(struct.pack("<II", len(binary), BIN_CHUNK))
    output_bytes.extend(binary)
    output.write_bytes(output_bytes)


def main() -> None:
    document, binary = read_glb(SOURCE)
    primitive = document["meshes"][0]["primitives"][0]
    position_index = primitive["attributes"]["POSITION"]
    index_index = primitive["indices"]
    positions = read_positions(document, binary, position_index)
    indices, index_component_type = read_indices(document, binary, index_index)
    position_payload = pack_positions(document, binary, position_index)
    normal_payload = build_normals(positions, indices)
    index_payload = pack_indices(document, binary, index_index)

    position_accessor = document["accessors"][position_index]
    document["asset"] = {
        "version": "2.0",
        "generator": "Holy Buck PLA web finalizer",
        "extras": {
            "source": "plakingforwebsite.glb",
            "notes": "Source preserved; simplified geometry; decoder-free 16-bit positions and normals; unused 8K textures removed.",
        },
    }
    document["meshes"] = [
        {
            "name": document["meshes"][0].get("name", "The King PLA Casting Pattern"),
            "primitives": [
                {
                    "attributes": {"POSITION": 0, "NORMAL": 1},
                    "indices": 2,
                    "material": 0,
                    "mode": 4,
                }
            ],
        }
    ]
    document["accessors"] = [
        {
            "bufferView": 0,
            "componentType": 5122,
            "normalized": True,
            "count": len(positions),
            "type": "VEC3",
            "min": position_accessor.get("min"),
            "max": position_accessor.get("max"),
        },
        {
            "bufferView": 1,
            "componentType": 5122,
            "normalized": True,
            "count": len(positions),
            "type": "VEC3",
        },
        {
            "bufferView": 2,
            "componentType": index_component_type,
            "count": len(indices),
            "type": "SCALAR",
        },
    ]
    document["materials"] = [
        {
            "name": "Holy Buck — PLA source",
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.72, 0.67, 0.57, 1],
                "metallicFactor": 0,
                "roughnessFactor": 0.64,
            },
        }
    ]
    document["extensionsUsed"] = ["KHR_mesh_quantization"]
    document["extensionsRequired"] = ["KHR_mesh_quantization"]
    for key in ("textures", "images", "samplers"):
        document.pop(key, None)

    write_glb(
        document,
        [
            (position_payload, 34962, 8),
            (normal_payload, 34962, 8),
            (index_payload, 34963, None),
        ],
        OUTPUT,
    )
    print(f"Created {OUTPUT.name}")
    print(f"Output: {OUTPUT.stat().st_size / 1048576:.2f} MiB")
    print(f"Vertices: {len(positions):,}; triangles: {len(indices) // 3:,}")


if __name__ == "__main__":
    main()
