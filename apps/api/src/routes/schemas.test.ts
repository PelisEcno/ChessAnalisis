import { describe, expect, it } from "vitest";
import { MagicLinkRequestSchema } from "../auth/plugin.js";
import { GameReportParamsSchema } from "./games.js";
import { ImportParamsSchema, ImportQuerySchema } from "./import.js";

describe("MagicLinkRequestSchema", () => {
  it("acepta un email válido", () => {
    expect(MagicLinkRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(
      true,
    );
  });

  it("rechaza un email inválido", () => {
    expect(
      MagicLinkRequestSchema.safeParse({ email: "no-es-un-email" }).success,
    ).toBe(false);
  });

  it("rechaza si falta el email", () => {
    expect(MagicLinkRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("ImportParamsSchema", () => {
  it("acepta chesscom y lichess", () => {
    expect(
      ImportParamsSchema.safeParse({ platform: "chesscom", username: "hikaru" })
        .success,
    ).toBe(true);
    expect(
      ImportParamsSchema.safeParse({
        platform: "lichess",
        username: "DrNykterstein",
      }).success,
    ).toBe(true);
  });

  it("rechaza una plataforma desconocida", () => {
    expect(
      ImportParamsSchema.safeParse({ platform: "lichess.org", username: "x" })
        .success,
    ).toBe(false);
  });

  it("rechaza un username vacío", () => {
    expect(
      ImportParamsSchema.safeParse({ platform: "chesscom", username: "" })
        .success,
    ).toBe(false);
  });
});

describe("ImportQuerySchema", () => {
  it("usa 20 como default si no se manda limit", () => {
    const result = ImportQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(20);
  });

  it("acepta un limit válido como string (query params)", () => {
    const result = ImportQuerySchema.safeParse({ limit: "5" });
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(5);
  });

  it("rechaza un limit fuera de rango", () => {
    expect(ImportQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(ImportQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});

describe("GameReportParamsSchema", () => {
  it("acepta un uuid válido", () => {
    expect(
      GameReportParamsSchema.safeParse({
        id: "e2c57851-2c24-49c0-990c-564665e1e8d2",
      }).success,
    ).toBe(true);
  });

  it("rechaza algo que no sea un uuid", () => {
    expect(
      GameReportParamsSchema.safeParse({ id: "no-es-un-uuid" }).success,
    ).toBe(false);
  });
});
