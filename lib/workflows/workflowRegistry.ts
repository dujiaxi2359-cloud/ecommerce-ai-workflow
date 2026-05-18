import type { WorkflowConfig } from "@/lib/workflows/workflowTypes";

export const workflowRegistry: WorkflowConfig[] = [
  {
    id: "text-image",
    name: "文本生图",
    description: "使用文字 prompt 生成电商视觉。",
    featureKey: "text-image",
    enabled: true,
    route: "/api/generate-image",
  },
  {
    id: "reference-mimic",
    name: "参考图模仿生图",
    description: "参考图片风格、构图和氛围，使用产品图作为固定主体。",
    featureKey: "reference-mimic",
    enabled: true,
    route: "/api/generate-reference",
  },
  {
    id: "product-workflow",
    name: "产品图工作流",
    description: "锁定产品主体，按提示词生成背景、场景和光影。",
    featureKey: "product-workflow",
    enabled: true,
    route: "/api/product-workflow",
  },
  {
    id: "product-variant",
    name: "产品风格变体",
    description: "同一产品多风格展示图。",
    featureKey: "product-variant",
    enabled: true,
    route: "/api/product-variant",
  },
  {
    id: "detail-workflow",
    name: "电商详情图",
    description: "详情图蓝图规划、编辑与批量生成。",
    featureKey: "detail-batch",
    enabled: true,
    route: "/api/detail-batch-generate",
  },
  {
    id: "poster-workflow",
    name: "海报工作流",
    description: "生成产品海报和活动图。",
    featureKey: "poster",
    enabled: true,
    route: "/api/poster-generate",
  },
];

export function getWorkflowConfig(id: string) {
  return workflowRegistry.find((workflow) => workflow.id === id);
}
