import { builtInLicenseCodes, licensePlans } from "@/lib/license/licensePlans";
import type { LicensePlanId, LicenseStatus } from "@/lib/license/licenseTypes";

function parseEnvCodes() {
  return (process.env.COMMERCE_AI_LICENSE_CODES || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, LicensePlanId>>((acc, entry) => {
      const [code, plan = "pro"] = entry.split(":").map((item) => item.trim());
      if (code && plan in licensePlans) acc[code] = plan as LicensePlanId;
      return acc;
    }, {});
}

export function verifyLicense(code: string): LicenseStatus {
  const normalized = code.trim();
  const planId = { ...builtInLicenseCodes, ...parseEnvCodes() }[normalized];

  if (!planId) {
    return {
      valid: false,
      code: normalized,
      features: [],
      message: "授权码无效，请检查后重试。",
    };
  }

  const plan = licensePlans[planId];
  return {
    valid: true,
    code: normalized,
    planId,
    features: plan.features,
    message: `已激活 ${plan.name} 权限。`,
  };
}
