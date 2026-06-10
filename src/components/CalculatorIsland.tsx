import { useEffect, useMemo, useState } from "react";
import { allowedMeshesFor, allowedProductsFor, estimate, normalizeItem, type CalculatorItemState } from "../lib/calculator";
import type { CalculatorContext, CalculatorOptions, CompatibilityConfig, District, Lang, PricingConfig } from "../lib/schemas";

type Props = { lang: Lang; pageKey: string; context: CalculatorContext; pricing: PricingConfig; options: CalculatorOptions; compatibility: CompatibilityConfig; districts: District[] };
type View = "config" | "selector" | "contact";
type SelectorKey = "objectType" | "productType" | "mesh" | "profileType" | "frameColor" | "fastener" | "district";
type SelectorOption = { value: string; label: string; description?: string; disabled?: boolean };
type ContactState = { name: string; channel: "phone" | "whatsapp" | "telegram"; value: string; address: string; comment: string };

const copy = {
  uk: { title: "Швидка конфігурація", subtitle: "нова позиція", productType: "Тип сітки", objectType: "Об'єкт монтажу", mesh: "Полотно", profileType: "Тип профілю", frameColor: "Колір рамки", fastener: "Кріплення", sizes: "Розміри", width: "Ширина, мм", height: "Висота, мм", quantity: "Кількість", services: "Послуги", request: "Запит", products: "Вироби", total: "Разом", active: "Редагована позиція", add: "Додати позицію", goContact: "Перейти до заявки", noParams: "Не знаю параметрів - прошу зв'язатися", contactTitle: "Заявка на розрахунок", name: "Ім'я", contact: "Контакт", address: "Адреса або орієнтир", district: "Район Києва", comment: "Коментар", photo: "Фото", submit: "Надіслати заявку", choose: "Не обрано", advisor: "Підбере консультант", from: "від", below: "Розмір нижче мінімального для цієї комплектації.", clarify: "Можна надіслати заявку без повних параметрів. Консультант уточнить деталі.", unavailable: "Недоступно для поточного вибору" },
  ru: { title: "Быстрая конфигурация", subtitle: "новая позиция", productType: "Тип сетки", objectType: "Объект монтажа", mesh: "Полотно", profileType: "Тип профиля", frameColor: "Цвет рамки", fastener: "Крепление", sizes: "Размеры", width: "Ширина, мм", height: "Высота, мм", quantity: "Количество", services: "Услуги", request: "Запрос", products: "Изделия", total: "Итого", active: "Редактируемая позиция", add: "Добавить позицию", goContact: "Перейти к заявке", noParams: "Не знаю параметры - прошу связаться", contactTitle: "Заявка на расчет", name: "Имя", contact: "Контакт", address: "Адрес или ориентир", district: "Район Киева", comment: "Комментарий", photo: "Фото", submit: "Отправить заявку", choose: "Не выбрано", advisor: "Подберет консультант", from: "от", below: "Размер ниже минимального для этой комплектации.", clarify: "Можно отправить заявку без полных параметров. Консультант уточнит детали.", unavailable: "Недоступно для текущего выбора" },
};

const draftKey = "kyiv-moskitky:calculator-draft";

function optionLabel(options: { id: string; label: Record<Lang, string> }[], id: string, lang: Lang, fallback: string) { return options.find((option) => option.id === id)?.label[lang] || fallback; }
function makeItem(context: CalculatorContext): CalculatorItemState { return { productType: context.productType || "frame", objectType: context.objectType || "window", mesh: context.mesh || "standard", frameColor: context.frameColor || "white", profileType: context.profileType || "standard", fastener: context.fastener || "hooks", widthMm: "", heightMm: "", quantity: "1" }; }
function hasItemInput(item: CalculatorItemState) { return Boolean(item.productType || item.objectType || item.widthMm || item.heightMm || item.quantity !== "1"); }
function readDraft() { try { return JSON.parse(window.sessionStorage.getItem(draftKey) || "{}"); } catch { return {}; } }

export default function CalculatorIsland({ lang, pageKey, context, pricing, options, compatibility, districts }: Props) {
  const t = copy[lang];
  const [items, setItems] = useState<CalculatorItemState[]>([normalizeItem(makeItem(context), compatibility)]);
  const [services, setServices] = useState<string[]>(context.services || []);
  const [district, setDistrict] = useState(context.district || "");
  const [view, setView] = useState<View>("config");
  const [activeSelector, setActiveSelector] = useState<SelectorKey>("mesh");
  const [contact, setContact] = useState<ContactState>({ name: "", channel: "phone", value: "", address: "", comment: "" });
  const activeItem = items[items.length - 1];
  const savedItems = items.slice(0, -1).filter(hasItemInput);

  function canEdit(key: string) { return !context.disabled.includes(key) && !context.fixed[key]; }
  function updateActive(patch: Partial<CalculatorItemState>) { setItems((current) => current.map((item, index) => index === current.length - 1 ? normalizeItem({ ...item, ...patch }, compatibility) : item)); }

  useEffect(() => {
    const draft = readDraft();
    if (Array.isArray(draft.items) && draft.items.length) setItems(draft.items.map((item: CalculatorItemState) => normalizeItem(item, compatibility)));
    if (Array.isArray(draft.services)) setServices(draft.services);
    if (typeof draft.district === "string") setDistrict(draft.district);
    if (draft.contact) setContact((current) => ({ ...current, ...draft.contact }));
    const params = new URLSearchParams(window.location.search);
    const patch: Partial<CalculatorItemState> = {};
    for (const key of ["productType", "objectType", "mesh", "frameColor", "profileType", "fastener"] as SelectorKey[]) {
      const value = params.get(key);
      if (value && canEdit(key)) patch[key as keyof CalculatorItemState] = value;
    }
    const districtParam = params.get("district");
    if (districtParam) setDistrict(districtParam);
    if (Object.keys(patch).length) updateActive(patch);
  }, []);

  useEffect(() => { window.sessionStorage.setItem(draftKey, JSON.stringify({ items, services, district, contact })); }, [items, services, district, contact]);

  function setSelectorValue(value: string) { if (activeSelector === "district") setDistrict(value); else if (canEdit(activeSelector)) updateActive({ [activeSelector]: value } as Partial<CalculatorItemState>); setView("config"); }
  function addPosition() { setItems((current) => [...current, normalizeItem(makeItem(context), compatibility)]); }
  function editSavedItem(index: number) { setItems((current) => [...current.filter((_, itemIndex) => itemIndex !== index), current[index]]); }
  function removeSavedItem(index: number) { setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); }
  function toggleService(serviceId: string) { if (!canEdit("services")) return; setServices((current) => current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]); }

  const activeProductRules = compatibility.products[activeItem.productType];
  const allowedProducts = useMemo(() => allowedProductsFor({ objectType: activeItem.objectType, mesh: activeItem.mesh, compatibility }), [activeItem.objectType, activeItem.mesh, compatibility]);
  const allowedMeshes = useMemo(() => allowedMeshesFor(activeItem.productType, compatibility), [activeItem.productType, compatibility]);
  const estimates = items.map((item) => estimate({ context, pricing, compatibility, item, services: [] }));
  const activeEstimate = estimates[estimates.length - 1];
  const activeWithServices = estimate({ context, pricing, compatibility, item: activeItem, district, services });
  const activeServicePrice = activeWithServices.status === "priced" && activeEstimate.status === "priced" ? activeWithServices.price - activeEstimate.price : 0;
  const productTotal = estimates.reduce((sum, item) => sum + item.price, 0);
  const orderTotal = productTotal + activeServicePrice;
  const needsClarification = estimates.some((item) => item.status === "individual" || item.status === "below-minimum");
  const hasFrom = estimates.some((item) => item.isFrom);
  const totalLabel = needsClarification ? t.advisor : `${hasFrom ? `${t.from} ` : ""}${orderTotal} ${pricing.currency}`;

  const selectorDefinitions: Record<SelectorKey, { title: string; value: string; options: SelectorOption[] }> = {
    objectType: { title: t.objectType, value: activeItem.objectType, options: options.objectTypes.map((option) => ({ value: option.id, label: option.label[lang] })) },
    productType: { title: t.productType, value: activeItem.productType, options: options.productTypes.map((option) => ({ value: option.id, label: option.label[lang], disabled: !allowedProducts.includes(option.id), description: !allowedProducts.includes(option.id) ? t.unavailable : undefined })) },
    mesh: { title: t.mesh, value: activeItem.mesh, options: options.meshes.map((option) => ({ value: option.id, label: option.label[lang], disabled: !allowedMeshes.includes(option.id), description: !allowedMeshes.includes(option.id) ? t.unavailable : undefined })) },
    profileType: { title: t.profileType, value: activeItem.profileType, options: options.profileTypes.map((option) => ({ value: option.id, label: option.label[lang] })) },
    frameColor: { title: t.frameColor, value: activeItem.frameColor, options: options.frameColors.map((option) => ({ value: option.id, label: option.label[lang] })) },
    fastener: { title: t.fastener, value: activeItem.fastener, options: options.fasteners.map((option) => ({ value: option.id, label: option.label[lang] })) },
    district: { title: t.district, value: district, options: [{ value: "", label: t.choose }, ...districts.map((item) => ({ value: item.id, label: item.label[lang] }))] },
  };

  function selectedLabel(selector: SelectorKey) { const definition = selectorDefinitions[selector]; return definition.options.find((option) => option.value === definition.value)?.label || t.choose; }
  function stateRow(selector: SelectorKey, label: string, value: string) { return <button type="button" className="state-row" disabled={selector !== "district" && !canEdit(selector)} onClick={() => { setActiveSelector(selector); setView("selector"); }}><span><strong>{label}</strong></span><b>{value}</b></button>; }
  function itemLabel(item: CalculatorItemState) { return `${optionLabel(options.objectTypes, item.objectType, lang, item.objectType)} · ${item.widthMm || "-"}×${item.heightMm || "-"} mm · ${item.quantity || "1"}`; }

  return (
    <section className="calculator-card calculator-shell" aria-label={t.title}>
      <div className="calculator-header"><div><strong>{t.title}</strong><small>{savedItems.length ? `${savedItems.length + 1} позиції` : t.subtitle}</small></div></div>
      <form className="calculator-form" method="post" action="/lead.php" encType="multipart/form-data">
        <input type="hidden" name="pageKey" value={pageKey} /><input type="hidden" name="lang" value={lang} /><input type="hidden" name="itemsJson" value={JSON.stringify(items)} /><input type="hidden" name="servicesJson" value={JSON.stringify(services)} /><input type="hidden" name="district" value={district} /><input type="hidden" name="estimate" value={String(orderTotal)} />
        {view === "selector" && <div className="selector-screen"><button type="button" className="back-link" onClick={() => setView("config")}>←</button><h3>{selectorDefinitions[activeSelector].title}</h3><div className="selector-list">{selectorDefinitions[activeSelector].options.map((option) => <button key={`${activeSelector}-${option.value}`} type="button" className={`selector-option ${selectorDefinitions[activeSelector].value === option.value ? "is-selected" : ""} ${option.disabled ? "is-disabled" : ""}`} disabled={option.disabled} onClick={() => setSelectorValue(option.value)}><span className="option-thumb" aria-hidden="true" /><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span><b>{selectorDefinitions[activeSelector].value === option.value ? "✓" : "›"}</b></button>)}</div></div>}
        {view === "config" && <>
          <div className="state-list">{stateRow("objectType", t.objectType, selectedLabel("objectType"))}{stateRow("productType", t.productType, selectedLabel("productType"))}{stateRow("mesh", t.mesh, selectedLabel("mesh"))}{stateRow("profileType", t.profileType, selectedLabel("profileType"))}{stateRow("frameColor", t.frameColor, selectedLabel("frameColor"))}{stateRow("fastener", t.fastener, selectedLabel("fastener"))}</div>
          <fieldset className="items-fieldset"><legend>{t.sizes}</legend><div className="measure-grid"><label>{t.width}<input inputMode="numeric" value={activeItem.widthMm} onChange={(event) => updateActive({ widthMm: event.target.value })} placeholder={String(activeProductRules?.minWidthMm || 1200)} /></label><label>{t.height}<input inputMode="numeric" value={activeItem.heightMm} onChange={(event) => updateActive({ heightMm: event.target.value })} placeholder={String(activeProductRules?.minHeightMm || 1400)} /></label><label>{t.quantity}<input inputMode="numeric" value={activeItem.quantity} onChange={(event) => updateActive({ quantity: event.target.value })} /></label></div>{activeEstimate.status === "below-minimum" && <p className="field-note is-warning">{t.below}</p>}</fieldset>
          <fieldset className="service-fieldset"><legend>{t.services}</legend>{options.services.map((service) => <label className="toggle-row" key={service.id}><input type="checkbox" checked={services.includes(service.id)} onChange={() => toggleService(service.id)} /><span><strong>{service.label[lang]}</strong><small>+{pricing.services[service.id]?.price || 0} {pricing.currency}</small></span></label>)}{stateRow("district", t.district, selectedLabel("district"))}</fieldset>
          <fieldset className="items-fieldset"><legend>{t.request}</legend><div className="order-summary"><div><span>{t.products}</span><strong>{hasFrom ? `${t.from} ` : ""}{productTotal} {pricing.currency}</strong></div><div><span>{t.total}</span><strong>{totalLabel}</strong></div></div>{hasFrom && <p className="field-note is-warning">{t.clarify}</p>}<div className="item-card is-active"><div><span>{t.active}</span><strong>{selectedLabel("productType")}</strong><small>{itemLabel(activeItem)}</small></div><strong>{activeEstimate.status === "below-minimum" ? "-" : `${activeEstimate.isFrom ? `${t.from} ` : ""}${activeEstimate.price} ${pricing.currency}`}</strong></div>{savedItems.map((item, index) => { const itemEstimate = estimates[index]; return <div className="item-card" key={`${item.productType}-${index}`}><button type="button" className="item-card-main" onClick={() => editSavedItem(index)}><span>Позиція {index + 1}</span><strong>{optionLabel(options.productTypes, item.productType, lang, item.productType)}</strong><small>{itemLabel(item)}</small></button><div className="item-card-side"><strong>{itemEstimate.isFrom ? `${t.from} ` : ""}{itemEstimate.price} {pricing.currency}</strong><button type="button" className="secondary-button compact-button" onClick={() => removeSavedItem(index)}>×</button></div></div>; })}<button type="button" className="secondary-button" onClick={addPosition}>{t.add}</button></fieldset>
          <div className="sticky-action"><span><small>{hasFrom ? `${t.total} ${t.from}` : t.total}</small><strong>{totalLabel}</strong></span><button type="button" className="button" onClick={() => setView("contact")}>{t.goContact}</button><button type="button" className="soft-link" onClick={() => setView("contact")}>{t.noParams}</button></div>
        </>}
        {view === "contact" && <div className="contact-screen"><button type="button" className="back-link" onClick={() => setView("config")}>←</button><div className="contact-intro"><h3>{t.contactTitle}</h3><p>{totalLabel}</p></div><div className="channel-options" role="radiogroup" aria-label={t.contact}>{(["phone", "whatsapp", "telegram"] as ContactState["channel"][]).map((channel) => <label className={`channel-pill ${contact.channel === channel ? "is-active" : ""}`} key={channel}><input type="radio" checked={contact.channel === channel} onChange={() => setContact((current) => ({ ...current, channel }))} />{channel}</label>)}</div><label>{t.name}<input name="name" value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} /></label><label>{t.contact}<input name="contact" value={contact.value} onChange={(event) => setContact((current) => ({ ...current, value: event.target.value }))} required /></label><label>{t.address}<input name="address" value={contact.address} onChange={(event) => setContact((current) => ({ ...current, address: event.target.value }))} /></label><label>{t.comment}<textarea name="comment" value={contact.comment} onChange={(event) => setContact((current) => ({ ...current, comment: event.target.value }))} /></label><label>{t.photo}<input name="photo" type="file" accept="image/*" /></label><button type="submit" className="button submit-button">{t.submit}</button></div>}
      </form>
    </section>
  );
}
