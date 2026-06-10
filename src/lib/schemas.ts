import { z } from "zod";

export const langSchema = z.enum(["uk", "ru"]);
export type Lang = z.infer<typeof langSchema>;

const localizedTextSchema = z.record(langSchema, z.string().min(1));

export const calculatorContextSchema = z.object({
  intent: z.string().min(1),
  productType: z.string().optional(),
  objectType: z.string().optional(),
  mesh: z.string().optional(),
  district: z.string().optional(),
  services: z.array(z.string()).default([]),
  fixed: z.record(z.string(), z.string()).default({}),
  disabled: z.array(z.string()).default([]),
});

export const pageSchema = z.object({
  key: z.string().min(1),
  cluster: z.enum(["home", "product", "object", "service", "protection", "info"]),
  routes: z.record(langSchema, z.string().startsWith("/")),
  seo: z.record(langSchema, z.object({
    title: z.string().min(1),
    description: z.string().min(1),
  })),
  content: z.record(langSchema, z.object({
    h1: z.string().min(1),
    lead: z.string().min(1),
    sections: z.array(z.object({
      title: z.string().min(1),
      text: z.string().min(1),
    })).default([]),
  })),
  calculator: calculatorContextSchema,
});
export type PageDefinition = z.infer<typeof pageSchema>;
export type CalculatorContext = z.infer<typeof calculatorContextSchema>;

export const optionSchema = z.object({
  id: z.string().min(1),
  label: localizedTextSchema,
});

export const districtSchema = z.object({
  id: z.string().min(1),
  label: localizedTextSchema,
  neighborhoods: z.record(langSchema, z.array(z.string()).default([])),
  serviceNote: localizedTextSchema,
});
export const districtsSchema = z.array(districtSchema);
export type District = z.infer<typeof districtSchema>;

export const optionsSchema = z.object({
  productTypes: z.array(optionSchema),
  objectTypes: z.array(optionSchema),
  meshes: z.array(optionSchema),
  frameColors: z.array(optionSchema),
  profileTypes: z.array(optionSchema),
  fasteners: z.array(optionSchema),
  services: z.array(optionSchema),
});
export type CalculatorOptions = z.infer<typeof optionsSchema>;

export const compatibilitySchema = z.object({
  products: z.record(z.string(), z.object({
    allowedObjects: z.array(z.string()),
    allowedMeshes: z.array(z.string()),
    minWidthMm: z.number().int().positive(),
    minHeightMm: z.number().int().positive(),
  })),
  meshes: z.record(z.string(), z.object({
    allowedProducts: z.array(z.string()),
  })),
});
export type CompatibilityConfig = z.infer<typeof compatibilitySchema>;

const quantityDiscountSchema = z.object({
  minQuantity: z.number().int().positive(),
  multiplier: z.number().positive(),
});

export const pricingSchema = z.object({
  currency: z.string().min(1),
  products: z.record(z.string(), z.object({
    label: localizedTextSchema,
    basePrice: z.number().nonnegative().optional(),
    perM2: z.number().nonnegative().optional(),
    minPrice: z.number().nonnegative().optional(),
    quantityDiscounts: z.array(quantityDiscountSchema).default([]),
    individualQuote: z.boolean().default(false),
  })),
  meshes: z.record(z.string(), z.object({
    label: localizedTextSchema,
    multiplier: z.number().positive(),
  })),
  services: z.record(z.string(), z.object({
    label: localizedTextSchema,
    price: z.number().nonnegative(),
  })),
  districtServiceSurcharges: z.record(z.string(), z.record(z.string(), z.number().nonnegative())).default({}),
});
export type PricingConfig = z.infer<typeof pricingSchema>;
