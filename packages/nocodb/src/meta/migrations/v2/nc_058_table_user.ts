import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.TABLE_USERS, (table) => {
    table.string('fk_model_id', 20).notNullable();
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);

    table.string('fk_user_id', 20).notNullable();
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);

    table.text('roles');

    table.string('base_id', 20);
    table.foreign('base_id').references(`${MetaTable.PROJECT}.id`);
      
    table.timestamps(true, true);
  });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.TABLE_USERS);
};

export { up, down };
