<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { ModelTypes } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { MetaInj, inject, ref, storeToRefs, useBase, useColumnCreateStoreOrThrow, useI18n, useMetas, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const { setAdditionalValidations, validateInfos, onDataTypeChange, isEdit, formState } = useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { metas, getMeta } = useMetas()

setAdditionalValidations({
  parentid: [{ required: true, message: t('general.required') }],
  fk_parent_column_id: [{ required: true, message: t('general.required') }],
  fk_child_column_id: [{ required: true, message: t('general.required') }],
  fk_lookup_column_id: [{ required: true, message: t('general.required') }],
})

if (!vModel.value.parentId) vModel.value.parentId = null
if (!vModel.value.fk_parent_column_id) vModel.value.fk_parent_column_id = null
if (!vModel.value.fk_child_column_id) vModel.value.fk_child_column_id = null
if (!vModel.value.fk_lookup_column_id) vModel.value.fk_lookup_column_id = null

const refTables = computed(() => {
  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id && t.id !== formState.value.model_id)
})

const allowXLookupTypes = [UITypes.ID, UITypes.SingleLineText, UITypes.Number, UITypes.Decimal, UITypes.Lookup, 
  UITypes.PhoneNumber, UITypes.Email, UITypes.Formula, UITypes.User
]

const columns = computed<ColumnType[]>(() => {
  return meta.value.columns.filter(
    (column) => !column.system && column.source_id === meta.value?.source_id && allowXLookupTypes.includes(column.uidt)
  )
})

const selectedTable = computed(() => {
  return refTables.value.find((t) => t.id === vModel.value.parentId)
})

const selectedChildColumn = computed<ColumnType[]>(() => {
  if (!vModel.value?.fk_child_column_id) {
    return undefined
  }
  return meta.value.columns.find(
    (c: ColumnType) => c.id === vModel.value.fk_child_column_id
  )
})

const parentColumns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id || !selectedChildColumn.value?.id) {
    return []
  }
  return metas.value[selectedTable.value.id]?.columns.filter(
    (c: ColumnType) => !c.system && c.uidt != UITypes.ForeignKey && allowXLookupTypes.includes(c.uidt)
  )
})

const lookupColumns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id) {
    return []
  }
  return metas.value[selectedTable.value.id]?.columns.filter(
    (c: ColumnType) =>
      !c.system && c.uidt !== UITypes.Links && c.uidt !== UITypes.Lookup && c.uidt !== UITypes.LinkToAnotherRecord &&
      c.uidt !== UITypes.XLookup && c.uidt !== UITypes.ForeignKey
  )
})

onMounted(() => {
  if (isEdit.value) {
    vModel.value.parentId = vModel.value.colOptions?.parentId
    vModel.value.fk_parent_column_id = vModel.value.colOptions?.fk_parent_column_id
    vModel.value.fk_lookup_column_id = vModel.value.colOptions?.fk_lookup_column_id
    vModel.value.fk_child_column_id = vModel.value.colOptions?.fk_child_column_id
  }
})

const onParentIdChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.id)
  }
  vModel.value.fk_parent_column_id = undefined
  vModel.value.fk_lookup_column_id = undefined
  onDataTypeChange()
}

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })
</script>

<template>
  <div class="pt-2 pb-2 pl-6 pr-6 w-full flex flex-col border-2 mb-2 mt-4">
    <div v-if="refTables.length" class="w-full flex flex-row space-x-2">
      <a-form-item class="flex w-1/2 pb-2" :label="$t('labels.linkingColumn')" v-bind="validateInfos.fk_child_column_id">
        <a-select
          v-model:value="vModel.fk_child_column_id"
          name="fk_child_column_id"
          dropdown-class-name="nc-dropdown-child-column !rounded-md"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) of columns" :key="index" :value="column.id">
            <div class="flex gap-2 truncate items-center">
              <div class="inline-flex items-center flex-1 truncate font-semibold">
                <component :is="cellIcon(column)" :column-meta="column" />
                <div class="truncate flex-1">{{ column.title }}</div>
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.fk_lookup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item
        class="flex w-1/2 pb-2 mt-4 nc-ltar-child-table"
        :label="$t('labels.childTable')"
        v-bind="validateInfos.parentId"
      >
        <a-select
          v-model:value="vModel.parentId"
          show-search
          :filter-option="filterOption"
          dropdown-class-name="nc-dropdown-ltar-child-table"
          @change="onParentIdChange"
        >
          <a-select-option v-for="table of refTables" :key="table.title" :value="table.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="table" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ table.title }}</template>
                <span>{{ table.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <div v-if="refTables.length" class="w-full flex flex-row space-x-2">
      <a-form-item class="flex w-1/2 pb-2" :label="$t('labels.linkedColumn')" v-bind="validateInfos.fk_parent_column_id">
        <a-select
          v-model:value="vModel.fk_parent_column_id"
          name="fk_parent_column_id"
          dropdown-class-name="nc-dropdown-relation-column !rounded-md"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) of parentColumns" :key="index" :value="column.id">
            <div class="flex gap-2 truncate items-center">
              <div class="inline-flex items-center flex-1 truncate font-semibold">
                <component :is="cellIcon(column)" :column-meta="column" />
                <div class="truncate flex-1">{{ column.title }}</div>
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.fk_lookup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item class="flex w-1/2" :label="$t('labels.childField')" v-bind="validateInfos.fk_lookup_column_id">
        <a-select
          v-model:value="vModel.fk_lookup_column_id"
          name="fk_lookup_column_id"
          dropdown-class-name="nc-dropdown-relation-column !rounded-md"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) of lookupColumns" :key="index" :value="column.id">
            <div class="flex gap-2 truncate items-center">
              <div class="inline-flex items-center flex-1 truncate font-semibold">
                <component :is="cellIcon(column)" :column-meta="column" />
                <div class="truncate flex-1">{{ column.title }}</div>
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.fk_lookup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    <div v-else>{{ $t('msg.linkColumnClearNotSupportedYet') }}</div>
  </div>
</template>

<style scoped>
:deep(.ant-select-selector .ant-select-selection-item .nc-relation-details) {
  @apply hidden;
}
</style>