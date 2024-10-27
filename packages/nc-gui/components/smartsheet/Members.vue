<script setup lang="ts">
import { LoadingOutlined } from '@ant-design/icons-vue'
import {
  OrderedTableRoles,
  OrgUserRoles,
  TableRoles,
  extractRolesObj,
  parseStringDateTime,
  timeAgo,
} from 'nocodb-sdk'

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { table } = storeToRefs(useTable())
const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const tablesStore = useTablesStore()
const { getTableUsers, createTableUser, updateTableUser, removeTableUser } = tablesStore
const { activeTableId } = storeToRefs(tablesStore)

const { orgRoles, tableRoles } = useRoles()

const { sorts, sortDirection, loadSorts, saveOrUpdate, handleGetSortedData } = useUserSorts('Table')

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const isInviteModalVisible = ref(false)

interface Collaborators {
  id: string
  email: string
  main_roles: OrgUserRoles
  roles: TableRoles
  table_roles: Roles
  workspace_roles: WorkspaceUserRoles
  created_at: string
  display_name: string | null
}

const collaborators = ref<Collaborators[]>([])
const totalCollaborators = ref(0)
const userSearchText = ref('')

const isLoading = ref(false)
const isSearching = ref(false)
const accessibleRoles = ref<(typeof TableRoles)[keyof typeof TableRoles][]>([])

const filteredCollaborators = computed(() =>
  collaborators.value.filter((collab) =>
    (collab.display_name || collab.email).toLowerCase().includes(userSearchText.value.toLowerCase()),
  ),
)

const sortedCollaborators = computed(() => {
  return handleGetSortedData(filteredCollaborators.value, sorts.value)
})

const loadCollaborators = async () => {
  try {
    const { users, totalRows } = await getTableUsers({
      tableId: activeTableId.value!,
      ...(!userSearchText.value ? {} : ({ searchText: userSearchText.value } as any)),
      force: true,
    })

    totalCollaborators.value = totalRows
    collaborators.value = [
      ...users
        .filter((u: any) => !u?.deleted)
        .map((user: any) => ({
          ...user,
          table_roles: user.roles,
          roles: extractRolesObj(user.main_roles)?.[OrgUserRoles.SUPER_ADMIN]
            ? OrgUserRoles.SUPER_ADMIN
            : user.roles ??
              (user.workspace_roles
                ? WorkspaceRolesToTableRoles[user.workspace_roles as WorkspaceUserRoles] ?? TableRoles.NO_ACCESS
                : TableRoles.NO_ACCESS),
        })),
    ]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const updateCollaborator = async (collab: any, roles: TableRoles) => {
  const currentCollaborator = collaborators.value.find((coll) => coll.id === collab.id)!

  try {
    if (
      !roles ||
      (roles === TableRoles.NO_ACCESS && !isEeUI) ||
      (currentCollaborator.workspace_roles &&
        WorkspaceRolesToTableRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] === roles &&
        isEeUI)
    ) {
      await removeTableUser(activeTableId.value!, currentCollaborator as unknown as User)
      if (
        currentCollaborator.workspace_roles &&
        WorkspaceRolesToTableRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] === roles &&
        isEeUI
      ) {
        currentCollaborator.roles = WorkspaceRolesToTableRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles]
      } else {
        currentCollaborator.roles = TableRoles.NO_ACCESS
      }
    } else if (currentCollaborator.table_roles) {
      currentCollaborator.roles = roles
      await updateTableUser(activeTableId.value!, currentCollaborator as unknown as User)
    } else {
      currentCollaborator.roles = roles
      currentCollaborator.table_roles = roles
      await createTableUser(activeTableId.value!, currentCollaborator as unknown as User)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    loadCollaborators()
  }
}

onMounted(async () => {
  isLoading.value = true
  try {
    await loadCollaborators()
    const currentRoleIndex = OrderedTableRoles.findIndex(
      (role) => tableRoles.value && Object.keys(tableRoles.value).includes(role),
    )
    if (isSuper.value) {
      accessibleRoles.value = OrderedTableRoles.slice(1)
    } else if (currentRoleIndex !== -1) {
      accessibleRoles.value = OrderedTableRoles.slice(currentRoleIndex + 1)
    }
    loadSorts()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
})

watch(isInviteModalVisible, () => {
  if (!isInviteModalVisible.value) {
    loadCollaborators()
  }
})
</script>

<template>
  <div class="nc-collaborator-table-container mt-4 mx-12 nc-access-settings-view h-[calc(100vh-8rem)]">
    <!--LazyTableShareTableDlg v-model:model-value="isInviteModalVisible" /-->
    <div v-if="isLoading" class="nc-collaborators-list items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
    <template v-else>
      <div class="w-full flex flex-row justify-between items-tableline max-w-350 mt-6.5 mb-2 pr-0.25">
        <a-input v-model:value="userSearchText" class="!max-w-90 !rounded-md" :placeholder="$t('title.searchMembers')">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>

        <!--NcButton size="small" @click="isInviteModalVisible = true">
          <div class="flex gap-1">
            <component :is="iconMap.plus" class="w-4 h-4" />
            {{ $t('activity.addMembers') }}
          </div>
        </NcButton-->
      </div>

      <div v-if="isSearching" class="nc-collaborators-list items-center justify-center">
        <GeneralLoader size="xlarge" />
      </div>

      <div
        v-else-if="!filteredCollaborators?.length"
        class="nc-collaborators-list w-full h-full flex flex-col items-center justify-center mt-36"
      >
        <a-empty description="$t('title.noMembersFound')" />
      </div>
      <div v-else class="nc-collaborators-list mt-6 h-full">
        <div class="flex flex-col rounded-lg overflow-hidden border-1 max-w-350 max-h-[calc(100%-8rem)]">
          <div class="flex flex-row bg-gray-50 min-h-12 items-center border-b-1">
            <div class="text-gray-700 users-email-grid flex items-center space-x-2">
              <span>
                {{ $t('objects.users') }}
              </span>
              <LazyAccountUserMenu :direction="sortDirection.email" field="email" :handle-user-sort="saveOrUpdate" />
            </div>

            <div class="text-gray-700 user-access-grid flex items-center space-x-2">
              <span>
                {{ $t('general.access') }}
              </span>
              <LazyAccountUserMenu :direction="sortDirection.roles" field="roles" :handle-user-sort="saveOrUpdate" />
            </div>
            <div class="text-gray-700 date-joined-grid">{{ $t('title.dateJoined') }}</div>
          </div>

          <div class="flex flex-col nc-scrollbar-md">
            <div
              v-for="(collab, i) of sortedCollaborators"
              :key="i"
              class="user-row flex flex-row border-b-1 py-1 min-h-14 items-center"
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
              <div class="user-access-grid">
                <template v-if="accessibleRoles.includes(collab.roles)">
                  <RolesSelector
                    :role="collab.roles"
                    :roles="accessibleRoles"
                    :inherit="
                      isEeUI && collab.workspace_roles && WorkspaceRolesToTableRoles[collab.workspace_roles]
                        ? WorkspaceRolesToTableRoles[collab.workspace_roles]
                        : null
                    "
                    :description="false"
                    :on-role-change="(role) => updateCollaborator(collab, role as TableRoles)"
                  />
                </template>
                <template v-else>
                  <RolesBadge :role="collab.roles" />
                </template>
              </div>
              <div class="date-joined-grid">
                <NcTooltip class="max-w-full">
                  <template #title>
                    {{ parseStringDateTime(collab.created_at) }}
                  </template>
                  <span>
                    {{ timeAgo(collab.created_at) }}
                  </span>
                </NcTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.color-band {
  @apply w-6 h-6 left-0 top-2.5 rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

:deep(.ant-select-selection-item) {
  @apply mt-0.75;
}

.users-email-grid {
  @apply flex-grow ml-4 w-1/2;
}

.date-joined-grid {
  @apply w-1/4 flex items-start;
}

.user-access-grid {
  @apply w-1/4 flex justify-start;
}

.user-row {
  @apply w-full;
}
.user-row:last-child {
  @apply border-b-0;
}





.tab {
  @apply flex flex-row items-center gap-x-1.5 pr-0.5;
}

:deep(.ant-tabs-nav) {
  min-height: calc(var(--topbar-height) - 1.75px);
}
</style>

<style lang="scss">
.nc-members-tab.nc-tabs.centered {
  > .ant-tabs-nav {
    .ant-tabs-nav-wrap {
      @apply absolute mx-auto -left-9.5;
    }
  }
}

.nc-members-tab-left-sidebar-close > .nc-members-tab.nc-tabs.centered {
  > .ant-tabs-nav {
    .ant-tabs-nav-wrap {
      @apply absolute mx-auto left-0;
    }
  }
}
</style>
