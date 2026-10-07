import toledo800 from "../art/toledo-800.webp";
import toledo1400 from "../art/toledo-1400.webp";
import { ParcelFinder } from "./ParcelFinder";

/**
 * The page with no parcel open yet. The finder card floats over a painting,
 * the same pattern as the personal site's hero; the painting is decoration
 * only, so it carries no alt text.
 */
export function FinderHero() {
  return (
    <section className="space-y-5">
      <h1 className="max-w-4xl font-serif text-[36px] leading-[1.04] tracking-[-0.015em] sm:text-[56px]">
        Every San Diego parcel, with the homes zoning already permits.{" "}
        <span className="text-soft">Look one up.</span>
      </h1>

      <div className="relative overflow-hidden rounded-2xl bg-[#3a4540] px-3 pb-3 pt-36 shadow-[0_30px_60px_-30px_rgba(43,29,18,.45)] sm:px-10 sm:pb-12 sm:pt-24">
        <img
          src={toledo1400}
          srcSet={`${toledo800} 800w, ${toledo1400} 1400w`}
          sizes="(min-width: 1152px) 1152px, 100vw"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[75%_60%] sm:object-[50%_30%]"
        />
        <div className="relative mx-auto max-w-4xl rounded-2xl shadow-[0_30px_60px_-16px_rgba(25,18,10,.5)]">
          <ParcelFinder />
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-2 px-1">
        <span className="eyebrow">El Greco, View of Toledo, ca. 1599 to 1600</span>
        <span className="eyebrow">The Met, Open Access CC0</span>
      </div>
    </section>
  );
}
