<script setup lang="ts">
const { getMeta } = useMetas()

const { loadTableRoles } = useRoles()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

const route = useRoute()

const activeTab = inject(
  TabMetaInj,
  computed(() => ({} as TabItem)),
)

watch(
  () => route.params.viewId,
  (viewId) => {
    /** wait until table list loads since meta load requires table list **/
    until(tables)
      .toMatch((tables) => tables.length > 0)
      .then(() => {
        getMeta(viewId as string)
      })
  },
  { immediate: true },
)

  onBeforeMount(async () => {
    await loadTableRoles(route.params.viewId)
  })
</script>

<template>
  <div class="w-full h-full relative">
    <LazyTabsSmartsheet :active-tab="activeTab" />
  </div>
</template>
