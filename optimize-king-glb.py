"""Create a non-destructive, web-focused copy of models/king.glb.

The source scan is preserved verbatim. The web copy removes the diffuse texture
that the site does not use, reduces the 8K normal map to 4K, and quantizes mesh
attributes without changing topology or triangle count.
"""

from __future__ import annotations

import io
import json
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "models" / "king.glb"
OUTPUT = ROOT / "models" / "king-web.glb"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
COMPONENT_FORMATS = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
COMPONENT_SIZES = {key: struct.calcsize(value) for key, value in COMPONENT_FORMATS.items()}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise ValueError("Source is not a valid glTF 2.0 binary file.")

    offset = 12
    document = None
    binary = None
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
        raise ValueError("Source GLB must contain JSON and BIN chunks.")
    return document, binary


def accessor_values(document: dict, binary: bytes, accessor_index: int):
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    component_type = accessor["componentType"]
    component_count = TYPE_COMPONENTS[accessor["type"]]
    component_size = COMPONENT_SIZES[component_type]
    packed_size = component_size * component_count
    stride = view.get("byteStride", packed_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    unpack_format = "<" + COMPONENT_FORMATS[component_type] * component_count

    for index in range(accessor["count"]):
        yield struct.unpack_from(unpack_format, binary, start + index * stride)


def quantize_signed_short(values, component_count: int, scale: float, offset=None):
    tuples = list(values)
    payload = bytearray(len(tuples) * component_count * 2)
    minimum = [32767] * component_count
    maximum = [-32767] * component_count
    cursor = 0

    for value_tuple in tuples:
        for component in range(component_count):
            value = value_tuple[component]
            if offset is not None:
                value -= offset[component]
            quantized = max(-32767, min(32767, round(value / scale * 32767)))
            struct.pack_into("<h", payload, cursor, quantized)
            cursor += 2
            minimum[component] = min(minimum[component], quantized)
            maximum[component] = max(maximum[component], quantized)

    return bytes(payload), minimum, maximum, len(tuples)


def quantize_unsigned_short(values, component_count: int):
    tuples = list(values)
    payload = bytearray(len(tuples) * component_count * 2)
    minimum = [65535] * component_count
    maximum = [0] * component_count
    cursor = 0

    for value_tuple in tuples:
        for component in range(component_count):
            quantized = max(0, min(65535, round(value_tuple[component] * 65535)))
            struct.pack_into("<H", payload, cursor, quantized)
            cursor += 2
            minimum[component] = min(minimum[component], quantized)
            maximum[component] = max(maximum[component], quantized)

    return bytes(payload), minimum, maximum, len(tuples)


def copy_accessor_bytes(document: dict, binary: bytes, accessor_index: int) -> bytes:
    accessor = document["accessors"][accessor_index]
    component_count = TYPE_COMPONENTS[accessor["type"]]
    element_size = COMPONENT_SIZES[accessor["componentType"]] * component_count
    output = bytearray(accessor["count"] * element_size)
    cursor = 0
    for value_tuple in accessor_values(document, binary, accessor_index):
        fmt = "<" + COMPONENT_FORMATS[accessor["componentType"]] * component_count
        struct.pack_into(fmt, output, cursor, *value_tuple)
        cursor += element_size
    return bytes(output)


def rotate_vector(vector, quaternion):
    x, y, z, w = quaternion
    vx, vy, vz = vector
    ix = w * vx + y * vz - z * vy
    iy = w * vy + z * vx - x * vz
    iz = w * vz + x * vy - y * vx
    iw = -x * vx - y * vy - z * vz
    return [
        ix * w + iw * -x + iy * -z - iz * -y,
        iy * w + iw * -y + iz * -x - ix * -z,
        iz * w + iw * -z + ix * -y - iy * -x,
    ]


def resize_normal_map(image_bytes: bytes) -> bytes:
    with Image.open(io.BytesIO(image_bytes)) as source_image:
        image = source_image.convert("RGB")
        if max(image.size) > 4096:
            ratio = 4096 / max(image.size)
            destination_size = tuple(max(1, round(value * ratio)) for value in image.size)
            image = image.resize(destination_size, Image.Resampling.LANCZOS)

        output = io.BytesIO()
        image.save(output, format="JPEG", quality=92, subsampling=0, optimize=True)
        return output.getvalue()


def image_bytes(document: dict, binary: bytes, image_index: int) -> bytes:
    image = document["images"][image_index]
    view = document["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return binary[start : start + view["byteLength"]]


def align_four(data: bytearray):
    while len(data) % 4:
        data.append(0)


def write_glb(document: dict, payloads: list[tuple[bytes, int | None]], output: Path):
    binary = bytearray()
    buffer_views = []
    for payload, target in payloads:
        align_four(binary)
        view = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(payload)}
        if target is not None:
            view["target"] = target
        buffer_views.append(view)
        binary.extend(payload)
    align_four(binary)

    document["bufferViews"] = buffer_views
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "

    total_length = 12 + 8 + len(json_bytes) + 8 + len(binary)
    glb = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    glb.extend(struct.pack("<II", len(json_bytes), JSON_CHUNK))
    glb.extend(json_bytes)
    glb.extend(struct.pack("<II", len(binary), BIN_CHUNK))
    glb.extend(binary)
    output.write_bytes(glb)


def main():
    document, binary = read_glb(SOURCE)
    primitive = document["meshes"][0]["primitives"][0]
    position_index = primitive["attributes"]["POSITION"]
    normal_index = primitive["attributes"]["NORMAL"]
    uv_index = primitive["attributes"]["TEXCOORD_0"]
    indices_index = primitive["indices"]

    position_accessor = document["accessors"][position_index]
    minimum = position_accessor["min"]
    maximum = position_accessor["max"]
    center = [(low + high) / 2 for low, high in zip(minimum, maximum)]
    half_extent = max((high - low) / 2 for low, high in zip(minimum, maximum))

    position_data, position_min, position_max, vertex_count = quantize_signed_short(
        accessor_values(document, binary, position_index), 3, half_extent, center
    )
    normal_data, _, _, normal_count = quantize_signed_short(
        accessor_values(document, binary, normal_index), 3, 1.0
    )

    uv_values = list(accessor_values(document, binary, uv_index))
    if any(component < 0 or component > 1 for values in uv_values for component in values):
        raise ValueError("UV coordinates fall outside 0–1; refusing lossy UV quantization.")
    uv_data, uv_min, uv_max, uv_count = quantize_unsigned_short(uv_values, 2)

    if not (vertex_count == normal_count == uv_count):
        raise ValueError("Mesh attribute counts do not match.")

    index_data = copy_accessor_bytes(document, binary, indices_index)
    index_source = document["accessors"][indices_index]
    normal_texture_source = document["textures"][0]["source"]
    normal_map = resize_normal_map(image_bytes(document, binary, normal_texture_source))

    node = dict(document["nodes"][0])
    if "matrix" in node:
        raise ValueError("Matrix-authored nodes are not supported by this safe optimizer.")
    quaternion = node.get("rotation", [0, 0, 0, 1])
    original_scale = node.get("scale", [1, 1, 1])
    original_translation = node.get("translation", [0, 0, 0])
    scaled_center = [center[index] * original_scale[index] for index in range(3)]
    rotated_center = rotate_vector(scaled_center, quaternion)
    node["translation"] = [
        original_translation[index] + rotated_center[index] for index in range(3)
    ]
    node["scale"] = [value * half_extent for value in original_scale]

    optimized = {
        "asset": {
            "version": "2.0",
            "generator": "Holy Buck loss-conscious web optimizer",
            "extras": {
                "source": "king.glb",
                "notes": "Original topology retained; 16-bit mesh attributes; 4K normal map; unused diffuse removed.",
            },
        },
        "scene": document.get("scene", 0),
        "scenes": document["scenes"],
        "nodes": [node],
        "meshes": [
            {
                "name": document["meshes"][0].get("name", "The King"),
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 3,
                        "material": 0,
                        "mode": primitive.get("mode", 4),
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": "The King — web source",
                "doubleSided": True,
                "normalTexture": {"index": 0, "scale": 1},
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.36, 0.18, 0.1, 1],
                    "metallicFactor": 0.94,
                    "roughnessFactor": 0.3,
                },
            }
        ],
        "samplers": document.get("samplers", [{}])[:1],
        "textures": [{"sampler": 0, "source": 0}],
        "images": [{"bufferView": 4, "mimeType": "image/jpeg", "name": "king_normal_4k"}],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5122,
                "normalized": True,
                "count": vertex_count,
                "type": "VEC3",
                "min": position_min,
                "max": position_max,
            },
            {
                "bufferView": 1,
                "componentType": 5122,
                "normalized": True,
                "count": normal_count,
                "type": "VEC3",
            },
            {
                "bufferView": 2,
                "componentType": 5123,
                "normalized": True,
                "count": uv_count,
                "type": "VEC2",
                "min": uv_min,
                "max": uv_max,
            },
            {
                "bufferView": 3,
                "componentType": index_source["componentType"],
                "count": index_source["count"],
                "type": "SCALAR",
            },
        ],
        "extensionsUsed": ["KHR_mesh_quantization"],
        "extensionsRequired": ["KHR_mesh_quantization"],
    }

    write_glb(
        optimized,
        [
            (position_data, 34962),
            (normal_data, 34962),
            (uv_data, 34962),
            (index_data, 34963),
            (normal_map, None),
        ],
        OUTPUT,
    )

    print(f"Created {OUTPUT.name}")
    print(f"Source: {SOURCE.stat().st_size / 1048576:.2f} MiB")
    print(f"Output: {OUTPUT.stat().st_size / 1048576:.2f} MiB")
    print(f"Vertices: {vertex_count:,}; indices: {index_source['count']:,}")


if __name__ == "__main__":
    main()
