import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["chesscom", "lichess"]);
export const gameResultEnum = pgEnum("game_result", [
  "1-0",
  "0-1",
  "1/2-1/2",
  "*",
]);
export const colorEnum = pgEnum("color", ["w", "b"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("users_email_unique").on(table.email)],
);

export const usersRelations = relations(users, ({ many }) => ({
  linkedAccounts: many(linkedAccounts),
}));

/** Cuenta de Chess.com/Lichess vinculada a un usuario de la app. */
export const linkedAccounts = pgTable(
  "linked_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("linked_accounts_user_platform_unique").on(
      table.userId,
      table.platform,
    ),
    index("linked_accounts_platform_username_idx").on(
      table.platform,
      table.username,
    ),
  ],
);

export const linkedAccountsRelations = relations(linkedAccounts, ({ one }) => ({
  user: one(users, { fields: [linkedAccounts.userId], references: [users.id] }),
}));

/**
 * Una partida es una entidad global (no de un usuario en particular): la
 * misma partida pública puede aparecer en el historial de ambos jugadores
 * si los dos usan la app. Se deduplica por (source, source_id).
 */
export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: platformEnum("source").notNull(),
    sourceId: varchar("source_id", { length: 100 }).notNull(),
    pgn: text("pgn").notNull(),
    url: text("url").notNull(),
    white: varchar("white", { length: 100 }).notNull(),
    black: varchar("black", { length: 100 }).notNull(),
    whiteElo: integer("white_elo"),
    blackElo: integer("black_elo"),
    result: gameResultEnum("result").notNull(),
    rated: boolean("rated").notNull(),
    timeControl: varchar("time_control", { length: 50 }).notNull(),
    eco: varchar("eco", { length: 10 }),
    opening: varchar("opening", { length: 200 }),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("games_source_source_id_unique").on(table.source, table.sourceId),
    index("games_white_idx").on(table.white),
    index("games_black_idx").on(table.black),
  ],
);

export const gamesRelations = relations(games, ({ many }) => ({
  analyses: many(analyses),
}));

/**
 * Un análisis de una partida con una versión y profundidad de motor
 * concretas. Nunca se re-analiza la misma partida con la misma versión y
 * profundidad (unique constraint).
 */
export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    engineVersion: varchar("engine_version", { length: 50 }).notNull(),
    depth: integer("depth").notNull(),
    /** GameReport completo (packages/core), tal cual lo devuelve buildGameReport. */
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("analyses_game_engine_depth_unique").on(
      table.gameId,
      table.engineVersion,
      table.depth,
    ),
  ],
);

export const analysesRelations = relations(analyses, ({ one, many }) => ({
  game: one(games, { fields: [analyses.gameId], references: [games.id] }),
  moveLabels: many(moveLabels),
}));

/**
 * Desglose normalizado de las etiquetas de cada jugada de un análisis: para
 * poder hacer las consultas agregadas de la fase 6 (patrones de error,
 * desglose por apertura, etc.) sin tener que escanear el JSONB completo.
 */
export const moveLabels = pgTable(
  "move_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    ply: integer("ply").notNull(),
    color: colorEnum("color").notNull(),
    label: varchar("label", { length: 20 }).notNull(),
    deltaWin: real("delta_win").notNull(),
    cpLoss: real("cp_loss").notNull(),
    phase: varchar("phase", { length: 20 }).notNull(),
  },
  (table) => [
    index("move_labels_analysis_idx").on(table.analysisId),
    index("move_labels_label_idx").on(table.label),
  ],
);

export const moveLabelsRelations = relations(moveLabels, ({ one }) => ({
  analysis: one(analyses, {
    fields: [moveLabels.analysisId],
    references: [analyses.id],
  }),
}));

/**
 * Estadísticas agregadas por usuario. La fase 6 (insights.ts) es la que
 * calcula estos valores; acá solo se define dónde se guardan.
 */
export const userStats = pgTable("user_stats", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  gamesAnalyzed: integer("games_analyzed").notNull().default(0),
  avgAccuracy: real("avg_accuracy"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
