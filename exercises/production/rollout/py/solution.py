MIGRATES = {"bugfix": "migrated_bug_fix", "policy": "policy_applies_today"}


def assign(request: dict, rollout: dict, change: str) -> dict:
    # Never pinned. A run that paused on Tuesday acts under Thursday's rules.
    policy_version = rollout["policyVersion"]

    if request["resuming"]:
        migrated = MIGRATES.get(change)
        # A quality improvement keeps the bundle the run was half-decided under.
        if migrated:
            return {
                "bundleId": rollout["candidate"],
                "reason": migrated,
                "policyVersion": policy_version,
            }
        return {
            "bundleId": request["pinnedBundleId"],
            "reason": "pinned_at_start",
            "policyVersion": policy_version,
        }

    if request["tenantId"] in rollout["holdout"]:
        return {
            "bundleId": rollout["stable"],
            "reason": "holdout",
            "policyVersion": policy_version,
        }

    # Sticky by tenant, so behaviour is consistent and the comparison is clean.
    if request["bucketBps"] < rollout["canaryFractionBps"]:
        return {
            "bundleId": rollout["candidate"],
            "reason": "canary",
            "policyVersion": policy_version,
        }

    return {
        "bundleId": rollout["stable"],
        "reason": "stable",
        "policyVersion": policy_version,
    }
