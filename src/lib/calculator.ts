import type { CalculatorContext, CompatibilityConfig, PricingConfig } from "./schemas";

export type CalculatorItemState = {
  productType: string;
  objectType: string;
  mesh: string;
  frameColor: string;
  profileType: string;
  fastener: string;
  widthMm: string;
  heightMm: string;
  quantity: string;
};

export type EstimateInput = {
  context: CalculatorContext;
  pricing: PricingConfig;
  compatibility: CompatibilityConfig;
  item: CalculatorItemState;
  district?: string;
  services?: string[];
};

export function allowedProductsFor(input: { objectType?: string; mesh?: string; compatibility: CompatibilityConfig }) {
  return Object.entries(input.compatibility.products)
    .filter(([, rules]) => !input.objectType || rules.allowedObjects.includes(input.objectType))
    .filter(([productId]) => !input.mesh || input.compatibility.meshes[input.mesh]?.allowedProducts.includes(productId))
    .map(([productId]) => productId);
}

export function allowedMeshesFor(productType: string | undefined, compatibility: CompatibilityConfig) {
  if (!productType) return Object.keys(compatibility.meshes);
  return compatibility.products[productType]?.allowedMeshes || [];
}

export function normalizeItem(item: CalculatorItemState, compatibility: CompatibilityConfig): CalculatorItemState {
  const next = { ...item };
  const allowedProducts = allowedProductsFor({ objectType: next.objectType, mesh: next.mesh, compatibility });
  if (!allowedProducts.includes(next.productType)) next.productType = allowedProducts[0] || "";
  const allowedMeshes = allowedMeshesFor(next.productType, compatibility);
  if (!allowedMeshes.includes(next.mesh)) next.mesh = allowedMeshes[0] || "standard";
  return next;
}

function quantityMultiplier(discounts: { minQuantity: number; multiplier: number }[] = [], quantity: number) {
  return discounts.filter((discount) => quantity >= discount.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0]?.multiplier ?? 1;
}

function servicePrice(pricing: PricingConfig, district: string | undefined, serviceId: string) {
  const base = pricing.services[serviceId]?.price || 0;
  const districtSurcharge = district ? pricing.districtServiceSurcharges[district]?.[serviceId] || 0 : 0;
  return base + districtSurcharge;
}

function modifierPrice(pricing: PricingConfig, group: "frameColors" | "profileTypes" | "fasteners", id: string) {
  return pricing.modifiers[group][id] || { multiplier: 1, fixed: 0 };
}

export function estimate(input: EstimateInput) {
  const item = normalizeItem(input.item, input.compatibility);
  const productRules = input.compatibility.products[item.productType];
  const productPrice = input.pricing.products[item.productType];

  if (!productRules || !productPrice || productPrice.individualQuote) {
    return { status: "individual" as const, price: 0, isFrom: true, minWidthMm: 0, minHeightMm: 0 };
  }

  const inputWidth = Number(item.widthMm);
  const inputHeight = Number(item.heightMm);
  const hasRealDimensions = inputWidth > 0 && inputHeight > 0;
  const widthMm = hasRealDimensions ? inputWidth : productRules.minWidthMm;
  const heightMm = hasRealDimensions ? inputHeight : productRules.minHeightMm;
  const isBelowMinimum = hasRealDimensions && (widthMm < productRules.minWidthMm || heightMm < productRules.minHeightMm);

  if (isBelowMinimum) {
    return { status: "below-minimum" as const, price: 0, isFrom: false, minWidthMm: productRules.minWidthMm, minHeightMm: productRules.minHeightMm };
  }

  const quantity = Math.max(1, Number(item.quantity) || 1);
  const areaM2 = (widthMm / 1000) * (heightMm / 1000);
  const meshMultiplier = input.pricing.meshes[item.mesh]?.multiplier ?? 1;
  const color = modifierPrice(input.pricing, "frameColors", item.frameColor);
  const profile = modifierPrice(input.pricing, "profileTypes", item.profileType);
  const fastener = modifierPrice(input.pricing, "fasteners", item.fastener);
  const configuredUnit = ((productPrice.basePrice || 0) + areaM2 * (productPrice.perM2 || 0) * meshMultiplier) * color.multiplier * profile.multiplier * fastener.multiplier + color.fixed + profile.fixed + fastener.fixed;
  const unit = Math.max(productPrice.minPrice || 0, configuredUnit);
  const productsTotal = Math.round(unit * quantity * quantityMultiplier(productPrice.quantityDiscounts, quantity));
  const selectedServices = input.services || input.context.services || [];
  const serviceTotal = selectedServices.reduce((sum, serviceId) => sum + servicePrice(input.pricing, input.district, serviceId), 0);

  return { status: "priced" as const, price: productsTotal + serviceTotal, isFrom: !hasRealDimensions, minWidthMm: productRules.minWidthMm, minHeightMm: productRules.minHeightMm };
}
