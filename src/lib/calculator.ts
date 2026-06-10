import type { CalculatorContext, CompatibilityConfig, PricingConfig } from "./schemas";

export type EstimateInput = {
  context: CalculatorContext;
  pricing: PricingConfig;
  compatibility: CompatibilityConfig;
  productType?: string;
  objectType?: string;
  mesh?: string;
  district?: string;
  widthMm?: number;
  heightMm?: number;
  quantity?: number;
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

function quantityMultiplier(discounts: { minQuantity: number; multiplier: number }[] = [], quantity: number) {
  return discounts
    .filter((discount) => quantity >= discount.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0]?.multiplier ?? 1;
}

function servicePrice(pricing: PricingConfig, district: string | undefined, serviceId: string) {
  const base = pricing.services[serviceId]?.price || 0;
  const districtSurcharge = district ? pricing.districtServiceSurcharges[district]?.[serviceId] || 0 : 0;
  return base + districtSurcharge;
}

export function estimate(input: EstimateInput) {
  const productType = input.productType || input.context.productType || "frame";
  const objectType = input.objectType || input.context.objectType || "window";
  const mesh = input.mesh || input.context.mesh || "standard";
  const district = input.district || input.context.district;
  const quantity = Math.max(1, input.quantity || 1);
  const productRules = input.compatibility.products[productType];
  const productPrice = input.pricing.products[productType];

  if (!productRules || !productPrice || productPrice.individualQuote) {
    return { status: "individual" as const, price: 0, isFrom: true, minWidthMm: 0, minHeightMm: 0 };
  }

  const hasRealDimensions = Boolean(input.widthMm && input.heightMm);
  const widthMm = input.widthMm || productRules.minWidthMm;
  const heightMm = input.heightMm || productRules.minHeightMm;
  const isBelowMinimum = hasRealDimensions && (widthMm < productRules.minWidthMm || heightMm < productRules.minHeightMm);

  if (isBelowMinimum) {
    return {
      status: "below-minimum" as const,
      price: 0,
      isFrom: false,
      minWidthMm: productRules.minWidthMm,
      minHeightMm: productRules.minHeightMm,
    };
  }

  const areaM2 = (widthMm / 1000) * (heightMm / 1000);
  const meshMultiplier = input.pricing.meshes[mesh]?.multiplier ?? 1;
  const unit = Math.max(productPrice.minPrice || 0, (productPrice.basePrice || 0) + areaM2 * (productPrice.perM2 || 0) * meshMultiplier);
  const productsTotal = Math.round(unit * quantity * quantityMultiplier(productPrice.quantityDiscounts, quantity));
  const selectedServices = input.services || input.context.services || [];
  const serviceTotal = selectedServices.reduce((sum, serviceId) => sum + servicePrice(input.pricing, district, serviceId), 0);

  return {
    status: "priced" as const,
    price: productsTotal + serviceTotal,
    isFrom: !hasRealDimensions,
    minWidthMm: productRules.minWidthMm,
    minHeightMm: productRules.minHeightMm,
  };
}
