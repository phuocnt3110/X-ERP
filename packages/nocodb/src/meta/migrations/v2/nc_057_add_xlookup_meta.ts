import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_XLOOKUP, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_child_column_id', 20);
    table
      .foreign('fk_child_column_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_parent_column_id', 20);
      table
        .foreign('fk_parent_column_id')
        .references(`${MetaTable.COLUMNS}.id`);
      
    table.string('parentId', 20);
      table
        .foreign('parentId')
        .references(`${MetaTable.MODELS}.id`);

    table.string('fk_lookup_column_id', 20);
    table.foreign('fk_lookup_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.boolean('deleted');

    table.timestamps(true, true);
  });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.COLUMNS);
};

export { up, down };