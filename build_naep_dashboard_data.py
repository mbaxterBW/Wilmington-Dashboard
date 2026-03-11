#!/usr/bin/env python3

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.error import URLError

BASE_URL = "https://www.nationsreportcard.gov/DataService/GetAdhocData.aspx"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "naep-dashboard.json"

ASSESSMENTS = [
    {"subject": "reading", "subjectLabel": "Reading", "grade": 4, "subscale": "RRPCM"},
    {"subject": "mathematics", "subjectLabel": "Mathematics", "grade": 8, "subscale": "MRPCM"},
]

YEARS = [2019, 2022, 2024]

JURISDICTIONS = {
    "NP": {"label": "National public", "type": "National", "parent": None},
    "MA": {"label": "Massachusetts", "type": "State", "parent": "National public"},
    "TX": {"label": "Texas", "type": "State", "parent": "National public"},
    "XB": {"label": "Boston", "type": "District", "parent": "Massachusetts"},
    "XH": {"label": "Houston", "type": "District", "parent": "Texas"},
}

VARIABLES = {
    "TOTAL": {"groups": {"1": "All students"}},
    "SDRACE": {
        "groups": {
            "1": "White",
            "2": "Black",
            "3": "Hispanic",
            "4": "Asian/Pacific Islander",
        }
    },
}

VARIABLES_BY_JURISDICTION_TYPE = {
    "National": ["TOTAL", "SDRACE"],
    "State": ["TOTAL", "SDRACE"],
    "District": ["TOTAL"],
}

STATTYPES = {
    "scaleScore": "MN:MN",
    "belowBasic": "ALC:BB",
    "basic": "ALD:BA",
    "proficient": "ALD:PR",
    "advanced": "ALD:AD",
    "p10": "PC:P1",
    "p25": "PC:P2",
    "p50": "PC:P5",
    "p75": "PC:P7",
    "p90": "PC:P9",
}


def fetch_json(params, timeout=30):
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.load(response)


def record_key(subject_label, grade, year, jurisdiction_code, group):
    return (subject_label, grade, year, jurisdiction_code, group)


def ensure_record(store, assessment, year, jurisdiction_code, group):
    key = record_key(assessment["subjectLabel"], assessment["grade"], year, jurisdiction_code, group)
    if key not in store:
        jurisdiction = JURISDICTIONS[jurisdiction_code]
        store[key] = {
            "year": year,
            "subject": assessment["subjectLabel"],
            "grade": assessment["grade"],
            "jurisdiction": jurisdiction["label"],
            "jurisdictionCode": jurisdiction_code,
            "jurisdictionType": jurisdiction["type"],
            "parentJurisdiction": jurisdiction["parent"],
            "group": group,
            "scaleScore": None,
            "proficiencyShares": {
                "belowBasic": None,
                "basic": None,
                "proficient": None,
                "advanced": None,
            },
            "percentilePoints": {
                "p10": None,
                "p25": None,
                "p50": None,
                "p75": None,
                "p90": None,
            },
        }
    return store[key]


def build_dataset():
    store = {}

    for assessment in ASSESSMENTS:
        for metric, stattype in STATTYPES.items():
            for jurisdiction_code, jurisdiction_meta in JURISDICTIONS.items():
                allowed_variables = VARIABLES_BY_JURISDICTION_TYPE[jurisdiction_meta["type"]]
                for variable in allowed_variables:
                    config = VARIABLES[variable]
                    year_batches = YEARS if jurisdiction_meta["type"] == "District" else [",".join(str(year) for year in YEARS)]
                    for year_batch in year_batches:
                        params = {
                            "type": "data",
                            "subject": assessment["subject"],
                            "grade": str(assessment["grade"]),
                            "subscale": assessment["subscale"],
                            "variable": variable,
                            "jurisdiction": jurisdiction_code,
                            "stattype": stattype,
                            "Year": str(year_batch),
                        }
                        print(
                            f"Fetching {assessment['subjectLabel']} grade {assessment['grade']} {jurisdiction_code} {variable} {metric} {year_batch}",
                            flush=True,
                        )
                        rows = fetch_rows(params)
                        for row in rows:
                            if not row.get("isStatDisplayable"):
                                continue

                            group = config["groups"].get(str(row["varValue"]))
                            if not group:
                                continue

                            record = ensure_record(store, assessment, row["year"], jurisdiction_code, group)
                            value = round(float(row["value"]), 2)
                            if metric == "scaleScore":
                                record["scaleScore"] = value
                            elif metric in record["proficiencyShares"]:
                                record["proficiencyShares"][metric] = value
                            else:
                                record["percentilePoints"][metric] = value

                        time.sleep(0.05)

    records = [record for record in store.values() if record_complete(record)]
    records.sort(key=lambda item: (item["subject"], item["grade"], item["jurisdiction"], item["group"], item["year"]))
    return {
        "metadata": {
            "source": "NAEP Data Service API",
            "sourceUrl": BASE_URL,
            "documentationUrl": "https://www.nationsreportcard.gov/api_documentation.aspx",
            "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "years": YEARS,
            "jurisdictions": [value["label"] for value in JURISDICTIONS.values()],
            "notes": [
                "Achievement levels use official NAEP stattype codes ALC:BB, ALD:BA, ALD:PR, and ALD:AD.",
                "Quartile views in the dashboard are based on official percentile calls PC:P1, PC:P2, PC:P5, PC:P7, and PC:P9.",
            ],
        },
        "records": records,
    }


def fetch_rows(params):
    try:
        payload = fetch_json(params, timeout=30)
        return payload.get("result", [])
    except URLError:
        rows = []
        for year in YEARS:
            split_params = dict(params)
            split_params["Year"] = str(year)
            payload = fetch_json(split_params, timeout=30)
            rows.extend(payload.get("result", []))
            time.sleep(0.05)
        return rows


def record_complete(record):
    if record["scaleScore"] is None:
        return False
    if any(value is None for value in record["proficiencyShares"].values()):
        return False
    if any(value is None for value in record["percentilePoints"].values()):
        return False
    return True


def main():
    dataset = build_dataset()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, indent=2))
    print(f"Wrote {len(dataset['records'])} records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
