"""Adapt bundled Make Me a Hanzi graphics without inferring decomposition."""

import math


def character_strokes(record: dict) -> dict | None:
    for image in record.get("images") or []:
        if image.get("source") != "makemeahanzi" or image.get("type") != "Regular":
            continue
        data = image.get("data") or {}
        strokes, medians = data.get("strokes"), data.get("medians")
        if not isinstance(strokes, list) or not strokes or not all(isinstance(s, str) and s.strip() for s in strokes):
            continue
        if not isinstance(medians, list) or len(medians) != len(strokes):
            continue
        if not all(isinstance(median, list) and len(median) >= 2 and all(
            isinstance(point, list) and len(point) == 2 and all(
                isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
                for value in point) for point in median) for median in medians):
            continue
        components = record.get("components") or []
        groups = image.get("fragments") or []
        indices = [None] * len(strokes)
        # Fragment groups can describe a different decomposition or overlap.
        # Only expose a one-to-one, unambiguous mapping to displayed components.
        if len(groups) == len(components) and all(c.get("character") for c in components):
            valid = True
            for component, group in enumerate(groups):
                if not isinstance(group, list):
                    valid = False
                    break
                for stroke in group:
                    if (not isinstance(stroke, int) or isinstance(stroke, bool)
                            or not 0 <= stroke < len(strokes) or indices[stroke] is not None):
                        valid = False
                        break
                    indices[stroke] = component
                if not valid:
                    break
            if not valid:
                indices = [None] * len(strokes)
        return {"strokes": strokes, "medians": medians, "component_indices": indices,
                "source": "makemeahanzi"}
    return None
