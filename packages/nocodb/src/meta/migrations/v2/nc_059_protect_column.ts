import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COLUMN_USERS, (table) => {
    table.string('fk_column_id', 20).notNullable();
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_user_id', 20).notNullable();
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);

    table.string('base_id', 20).notNullable();
    table.foreign('base_id').references(`${MetaTable.PROJECT}.id`);
      
    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.string('protect_type');
  });

  await knex(MetaTable.COLUMNS).update({ protect_type: 'default' });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.COLUMN_USERS);

  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropColumn('protect_type');
  });
};

export { up, down };
