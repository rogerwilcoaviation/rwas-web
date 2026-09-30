"""Read-only metadata/schema evidence. Never dispatch, migrate, or expose values."""
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path


def api(path, sql=None):
    # The only POST is a fixed SELECT of schema metadata, never customer rows.
    data = None if sql is None else json.dumps({"sql": sql}).encode()
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/accounts/"
        + os.environ["CLOUDFLARE_ACCOUNT_ID"] + path,
        data=data,
        headers={"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"],
                 "Content-Type": "application/json"},
        method="GET" if sql is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get("success") is not True:
        raise ValueError("API did not confirm success")
    return result["result"]


def canonical(sql):
    return re.sub(r"\s+", "", sql or "").rstrip(";").lower()


def main():
    evidence = {"productionReady": "unverified", "providerCalls": 0,
                "customerRowsRead": 0, "configurationWrites": 0}
    try:
        project = api("/pages/projects/rwas-web")
        configurations = project.get("deployment_configs") or {}
        production = configurations.get("production") or {}
        preview = configurations.get("preview") or {}
        variables = production.get("env_vars") or {}
        required = ["INTAKE_DISPATCH_SECRET", "RESEND_API_KEY", "CONTACT_FROM_EMAIL",
                    "CONTACT_TO_EMAIL", "TURNSTILE_SECRET_KEY"]
        evidence["productionVariableMetadataPresent"] = {
            name: bool(variables.get(name)) for name in required}
        # These are metadata checks, not credential validity or mailbox approval.
        database_id = (production.get("d1_databases") or {}).get("INTAKE_RECEIPTS", {}).get("id")
        evidence["productionD1BindingPresent"] = bool(database_id)
        evidence["previewSharesProductionD1"] = bool(database_id) and any(
            row.get("id") == database_id
            for row in (preview.get("d1_databases") or {}).values())
        evidence["productionStagingModeEnabled"] = (
            (variables.get("INTAKE_STAGING_MODE") or {}).get("value") == "true")
        if database_id:
            # Provider-supplied ID is confined to the path and never printed.
            identifier = urllib.parse.quote(str(database_id), safe="")
            try:
                result = api("/d1/database/" + identifier + "/query",
                             "SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND name LIKE 'intake_%'")
                actual = {row["name"]: canonical(row["sql"])
                          for batch in result for row in batch.get("results", [])}
                migration = re.sub(r"--[^\n]*", "", Path("migrations/intake/0001_receipts.sql").read_text())
                expected = {re.match(r"\s*CREATE (?:TABLE|INDEX) (\w+)", statement).group(1): canonical(statement)
                            for statement in migration.split(";") if statement.strip()}
                evidence["intakeSchemaMatchesMigration"] = actual == expected
            except (urllib.error.URLError, ValueError, KeyError, TypeError):
                evidence["intakeSchemaMatchesMigration"] = "unverified: API access or response"
        else:
            evidence["intakeSchemaMatchesMigration"] = "unverified: no production binding"
    except (urllib.error.URLError, ValueError, KeyError, TypeError):
        # Never print provider error bodies, configuration values, bearer or IDs.
        evidence["cloudflareConfiguration"] = "unverified: API access or response"
    print(json.dumps(evidence, sort_keys=True))


if __name__ == "__main__":
    main()
