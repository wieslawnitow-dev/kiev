import { useMemo, useState } from "react";
import { allowedMeshesFor, allowedProductsFor, estimate } from "../lib/calculator";
import type { CalculatorContext, CalculatorOptions, CompatibilityConfig, Lang, PricingConfig } from "../lib/schemas";

type Props = {
  lang: Lang;
  pageKey: string;
  context: CalculatorContext;
  pricing: PricingConfig;
  options: CalculatorOptions;
  compatibility: CompatibilityConfig;
};

type OrderItem = {
  id: string;
  productType: string;
  objectType: string;
  mesh: string;
  widthMm: string;
  heightMm: string;
  quantity: string;
};

const copy = {
  uk: {
    title: "Калькулятор москіток",
    productType: "Тип сітки",
    objectType: "Об'єкт монтажу",
    mesh: "Полотно",
    width: "Ширина, мм",
    height: "Висота, мм",
    quantity: "Кількість",
    services: "Послуги",
    add: "Додати позицію",
    contact: "Контакт",
    comment: "Коментар",
    photo: "Фото",
    submit: "Надіслати заявку",
    from: "від",
    individual: "Індивідуальна оцінка",
    below: "Розмір нижче мінімального для цієї комплектації.",
  },
  ru: {
    title: "Калькулятор москиток",
    productType: "Тип сетки",
    objectType: "Объект монтажа",
    mesh: "Полотно",
    width: "Ширина, мм",
    height: "Высота, мм",
    quantity: "Количество",
    services: "Услуги",
    add: "Добавить позицию",
    contact: "Контакт",
    comment: "Комментарий",
    photo: "Фото",
    submit: "Отправить заявку",
    from: "от",
    individual: "Индивидуальная оценка",
    below: "Размер ниже минимального для этой комплектации.",
  },
};

function label(options: { id: string; label: Record<Lang, string> }[], id: string, lang: Lang) {
  return options.find((option) => option.id === id)?.label[lang] || id;
}

function newItem(context: CalculatorContext): OrderItem {
  return {
    id: crypto.randomUUID(),
    productType: context.productType || "frame",
    objectType: context.objectType || "window",
    mesh: context.mesh || "standard",
    widthMm: "",
    heightMm: "",
    quantity: "1",
  };
}

export default function CalculatorIsland({ lang, pageKey, context, pricing, options, compatibility }: Props) {
  const t = copy[lang];
  const [items, setItems] = useState<OrderItem[]>([newItem(context)]);
  const [services, setServices] = useState<string[]>(context.services || []);
  const [contact, setContact] = useState("");
  const [comment, setComment] = useState("");
  const activeItem = items[items.length - 1];

  const allowedProducts = useMemo(
    () => allowedProductsFor({ objectType: activeItem.objectType, mesh: activeItem.mesh, compatibility }),
    [activeItem.objectType, activeItem.mesh, compatibility],
  );
  const allowedMeshes = useMemo(() => allowedMeshesFor(activeItem.productType, compatibility), [activeItem.productType, compatibility]);

  const itemEstimates = items.map((item) =>
    estimate({
      context,
      pricing,
      compatibility,
      productType: item.productType,
      objectType: item.objectType,
      mesh: item.mesh,
      widthMm: Number(item.widthMm) || undefined,
      heightMm: Number(item.heightMm) || undefined,
      quantity: Number(item.quantity) || 1,
      services: [],
    }),
  );
  const serviceEstimate = estimate({ context, pricing, compatibility, productType: activeItem.productType, objectType: activeItem.objectType, mesh: activeItem.mesh, services });
  const total = itemEstimates.reduce((sum, item) => sum + item.price, 0) + (serviceEstimate.price - itemEstimates[itemEstimates.length - 1].price);
  const hasFrom = itemEstimates.some((item) => item.isFrom);
  const hasBelowMinimum = itemEstimates.some((item) => item.status === "below-minimum");

  function updateActive(patch: Partial<OrderItem>) {
    setItems((current) => current.map((item, index) => index === current.length - 1 ? { ...item, ...patch } : item));
  }

  function addPosition() {
    setItems((current) => [...current, newItem(context)]);
  }

  function toggleService(serviceId: string) {
    if (context.disabled.includes("services") || context.fixed.services) return;
    setServices((current) => current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]);
  }

  return (
    <section className="calculator-card" aria-label={t.title}>
      <div className="calculator-head">
        <div>
          <p className="eyebrow">{pageKey}</p>
          <h2>{t.title}</h2>
        </div>
        <strong className="price-label">
          {hasBelowMinimum ? "-" : `${hasFrom ? `${t.from} ` : ""}${total} ${pricing.currency}`}
        </strong>
      </div>

      <form className="calculator-form" method="post" action="/lead.php" encType="multipart/form-data">
        <input type="hidden" name="pageKey" value={pageKey} />
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
        <input type="hidden" name="servicesJson" value={JSON.stringify(services)} />
        <input type="hidden" name="estimate" value={String(total)} />

        <label>
          {t.objectType}
          <select value={activeItem.objectType} disabled={context.disabled.includes("objectType") || Boolean(context.fixed.objectType)} onChange={(event) => updateActive({ objectType: event.target.value })}>
            {options.objectTypes.map((option) => <option value={option.id} key={option.id}>{option.label[lang]}</option>)}
          </select>
        </label>

        <label>
          {t.productType}
          <select value={activeItem.productType} disabled={context.disabled.includes("productType") || Boolean(context.fixed.productType)} onChange={(event) => updateActive({ productType: event.target.value })}>
            {options.productTypes.map((option) => <option value={option.id} key={option.id} disabled={!allowedProducts.includes(option.id)}>{option.label[lang]}</option>)}
          </select>
        </label>

        <label>
          {t.mesh}
          <select value={activeItem.mesh} disabled={context.disabled.includes("mesh") || Boolean(context.fixed.mesh)} onChange={(event) => updateActive({ mesh: event.target.value })}>
            {options.meshes.map((option) => <option value={option.id} key={option.id} disabled={!allowedMeshes.includes(option.id)}>{option.label[lang]}</option>)}
          </select>
        </label>

        <div className="measure-grid">
          <label>{t.width}<input inputMode="numeric" value={activeItem.widthMm} onChange={(event) => updateActive({ widthMm: event.target.value })} placeholder="1200" /></label>
          <label>{t.height}<input inputMode="numeric" value={activeItem.heightMm} onChange={(event) => updateActive({ heightMm: event.target.value })} placeholder="1400" /></label>
          <label>{t.quantity}<input inputMode="numeric" value={activeItem.quantity} onChange={(event) => updateActive({ quantity: event.target.value })} /></label>
        </div>

        {hasBelowMinimum && <p className="warning">{t.below}</p>}

        <fieldset>
          <legend>{t.services}</legend>
          {options.services.map((service) => (
            <label className="check-row" key={service.id}>
              <input type="checkbox" checked={services.includes(service.id)} onChange={() => toggleService(service.id)} />
              <span>{service.label[lang]}</span>
            </label>
          ))}
        </fieldset>

        <button className="secondary-button" type="button" onClick={addPosition}>{t.add}</button>

        <label>{t.contact}<input name="contact" value={contact} onChange={(event) => setContact(event.target.value)} required /></label>
        <label>{t.comment}<textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
        <label>{t.photo}<input name="photo" type="file" accept="image/*" /></label>
        <button className="button" type="submit">{t.submit}</button>
      </form>
    </section>
  );
}
