<script setup lang="ts">
import type { User } from '#imports'
import { extractEmail } from '~/helpers/parsers/parserHelpers'

enum ProtectColumnType {
  Default = 'default',
  Owner = 'owner',
  Custom = 'custom'
}

interface ProtectColumn {
  type: string,
  users?: ColumnReqType[]
}

const props = defineProps<{
  modelValue: boolean
  baseId?: string
}>()
const emit = defineEmits(['close'])

const column = inject(ColumnInj)

const { api } = useApi()

const protectColumnType = ref<null | string>(null)
const columnUsers = ref([])

const { baseRoles } = useRoles()

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const saveColumnUser = () => {
  const userList = columnUsers.value.filter(e => e.fk_column_id).map(e => e.fk_user_id)

  api.dbTableColumn.protectColumnUpdate(column.value.id, {
    protect_type: protectColumnType.value,
    user_list: userList
  }, {})

  column.value.protect_type = protectColumnType.value;
  
  emit('close')
}

async function changeUserEnable(evt: CheckboxChangeEvent) {
  columnUsers.value[evt.target.value].fk_column_id = evt.target.checked ? column.value.id : undefined
}

const handleEnter = () => {
  saveColumnUser();
}

onMounted(() => {
  if (!protectColumnType.value && column) {
    protectColumnType.value = column.value.protect_type
  }
})

watch(protectColumnType, () => {
  if (protectColumnType.value == ProtectColumnType.Custom) {
    loadCollaborators()
  }
})

const loadCollaborators = async () => {
  try {
    const response: any = await api.source.columnUserGet(column?.value?.id, {} as RequestParams)
    columnUsers.value = response.user_list;
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
} 

</script>

<template>
  <NcModal
    visible="true"
    :show-separator="false"
    :header="$t('activity.protectColumnDlg')"
    size="small"
    @keydown.esc="emit('close')"
  >
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        {{ $t('activity.protectColumnDlg') }}
      </div>
    </template>
    <div class="flex items-center justify-between gap-3 mt-2">
      <div class="flex w-full flex-col">
        <div class="flex justify-between gap-3 w-full">
          <a-select
            v-model:value="protectColumnType"
            class="flex nc-protect-column-type w-full"
            dropdown-class-name="nc-dropdown-protect-column-type"
          >
            <template #suffixIcon>
              <div class="flex flex-row">
                <IcRoundKeyboardArrowDown class="text-black -mt-0.5 h-[1rem]" />
              </div>
            </template>

            <a-select-option
              :key="type"
              :value="ProtectColumnType.Default"
              dropdown-class-name="capitalize"
              @click="protectColumnType = ProtectColumnType.Default"
            >
              <div class="w-full px-2 capitalize">
                {{ $t('activity.protectColumnType.default') }}
              </div>
            </a-select-option>
            <a-select-option
              :key="type"
              :value="ProtectColumnType.Owner"
              dropdown-class-name="capitalize"
              @click="protectColumnType = ProtectColumnType.Owner"
            >
              <div class="w-full px-2 capitalize">
                {{ $t('activity.protectColumnType.owner') }}
              </div>
            </a-select-option>
            <a-select-option
                :key="type"
                :value="ProtectColumnType.Custom"
                dropdown-class-name="capitalize"
                @click="protectColumnType = ProtectColumnType.Custom"
              >
                <div class="w-full px-2 capitalize">
                  {{ $t('activity.protectColumnType.custom') }}
                </div>
            </a-select-option>
          </a-select>
        </div>

        <div v-if="protectColumnType == ProtectColumnType.Custom" class="nc-collaborators-list h-full mt-3">
          <span class="border-b-1 ml-1 choose-user-label mt-5 pb-2">
            {{ $t('activity.protectColumnCustomLabel') }}
          </span>

          <div class="flex flex-col rounded-lg overflow-hidden max-w-350 max-h-[calc(100%-8rem)]">
            <div class="flex flex-col nc-scrollbar-md">
              <div
                v-for="(collab, i) of columnUsers"
                :key="i"
                class="user-row flex flex-row py-1 border-b-1 min-h-14 items-center"
              >
                <div class="flex gap-3 items-center users-email-grid">
                  <GeneralUserIcon size="base" :email="collab.email" />
                  <NcTooltip v-if="collab.display_name">
                    <template #title>
                      {{ collab.email }}
                    </template>
                    <span class="truncate">
                      {{ collab.display_name }}
                    </span>
                  </NcTooltip>
                  <span v-else class="truncate">
                    {{ collab.email }}
                  </span>
                </div>
                <div class="user-access-checkbox">
                  <a-checkbox
                    v-model:checked="collab.fk_column_id"
                    :value="i"
                    class="nc-checkbox nc-user-access-enable"
                    name="virtual"
                    @change="changeUserEnable"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="emit('close')"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
          type="primary"
          size="medium"
          @click="saveColumnUser"
        >
          {{ $t('general.confirm') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.divider {
  @apply border-r-1 border-gray-200 w-100 h-1;
}

.choose-user-label {
  color: #606060;
  font-size: 10px;
}

.user-access-checkbox {
  position: absolute;
  right: 2.5rem
}
</style>