import { builtInLicenseCodes, licensePlans } from "@/lib/license/licensePlans";
import type { LicensePlanId, LicenseStatus } from "@/lib/license/licenseTypes";

function normalizeLicenseCode(code: string) {
  return code
    .trim()
    .replace(/[－—–]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function parseEnvCodes() {
  return (process.env.COMMERCE_AI_LICENSE_CODES || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, LicensePlanId>>((acc, entry) => {
      const [code, plan = "pro"] = entry.split(":").map((item) => item.trim());
      const normalizedCode = normalizeLicenseCode(code);
      if (normalizedCode && plan in licensePlans) {
        acc[normalizedCode] = plan as LicensePlanId;
      }
      return acc;
    }, {});
}

const normalizedBuiltInCodes = Object.entries(builtInLicenseCodes).reduce<Record<string, LicensePlanId>>(
  (acc, [code, plan]) => {
    acc[normalizeLicenseCode(code)] = plan;
    return acc;
  },
  {},
);

const licenseAliases: Record<string, LicensePlanId> = {
  TRIAL: "trial",
  BASIC: "basic",
  PRO: "pro",
  STUDIO: "studio",
  AI2026: "studio",
  AIGC2026: "studio",
};

export function verifyLicense(code: string): LicenseStatus {
  const normalized = normalizeLicenseCode(code);
  const planId = {
    ...normalizedBuiltInCodes,
    ...licenseAliases,
    ...parseEnvCodes(),
  }[normalized];

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
