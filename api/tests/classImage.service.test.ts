import { effectiveClassImage } from "../src/services/classImage.service.js";

describe("effectiveClassImage", () => {
  it("uses override, assigned type, named title match and legacy images in order", () => {
    const namedTypes = [{ name: "Yoga", imageUrl: "/types/yoga.webp" }];
    const legacyImages = [{ keyword: "Yoga", imageUrl: "/legacy/yoga.webp" }];

    expect(effectiveClassImage({
      title: "Yoga suave",
      imageUrl: "/classes/custom.webp",
      classType: { name: "Yoga", imageUrl: "/types/assigned.webp" }
    }, namedTypes, legacyImages)).toBe("/classes/custom.webp");

    expect(effectiveClassImage({
      title: "Yoga suave",
      classType: { name: "Yoga", imageUrl: "/types/assigned.webp" }
    }, namedTypes, legacyImages)).toBe("/types/assigned.webp");

    expect(effectiveClassImage({
      title: "Yoga suave",
      classType: { name: "General", imageUrl: null }
    }, namedTypes, legacyImages)).toBe("/types/yoga.webp");

    expect(effectiveClassImage({
      title: "Cardio suave",
      classType: { name: "General", imageUrl: null }
    }, namedTypes, [{ keyword: "Cardio", imageUrl: "/legacy/cardio.webp" }])).toBe("/legacy/cardio.webp");
  });

  it("prefers exact and longest complete normalized class-type names", () => {
    const namedTypes = [
      { name: "Yoga", imageUrl: "/types/yoga.webp" },
      { name: "Yoga suave", imageUrl: "/types/yoga-suave.webp" }
    ];

    expect(effectiveClassImage({
      title: "Clase de Y\u00d3GA-suave matinal",
      classType: { name: "General" }
    }, namedTypes, [])).toBe("/types/yoga-suave.webp");

    expect(effectiveClassImage({
      title: "Yogatherapy",
      classType: { name: "General" }
    }, namedTypes, [{ keyword: "General", imageUrl: "/legacy/general.webp" }])).toBe("/legacy/general.webp");
  });

  it("supports Functional aliases while preferring the canonical exact name", () => {
    expect(effectiveClassImage({
      title: "Functional fuerza",
      classType: { name: "General" }
    }, [{ name: "Entrenamiento funcional", imageUrl: "/types/functional-es.webp" }], []))
      .toBe("/types/functional-es.webp");

    expect(effectiveClassImage({
      title: "Functional",
      classType: { name: "General" }
    }, [
      { name: "Entrenamiento funcional", imageUrl: "/types/functional-es.webp" },
      { name: "Functional", imageUrl: "/types/functional.webp" }
    ], [])).toBe("/types/functional.webp");
  });

  it("does not title-match General or choose equally ranked ambiguous images", () => {
    const legacyFallback = [{ keyword: "General", imageUrl: "/legacy/general.webp" }];

    expect(effectiveClassImage({
      title: "General conditioning",
      classType: { name: "General" }
    }, [{ name: "General", imageUrl: "/types/general.webp" }], legacyFallback))
      .toBe("/legacy/general.webp");

    expect(effectiveClassImage({
      title: "Box fit",
      classType: { name: "General" }
    }, [
      { name: "Box-fit", imageUrl: "/types/box-a.webp" },
      { name: "Box fit", imageUrl: "/types/box-b.webp" }
    ], legacyFallback)).toBe("/legacy/general.webp");
  });
});
