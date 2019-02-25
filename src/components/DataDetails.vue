<template lang="pug">
.data-details
  v-toolbar(card, dark, dense, color="primary")
    v-toolbar-title.details-title
      v-icon.pr-2.mdi-18px {{ icon }}
      | {{ title }}
    v-spacer
    v-dialog(v-if="datum", v-model="showUpsert", full-width, max-width="800px")
      v-btn(slot="activator", icon)
        v-icon.mdi-18px {{ $vuetify.icons.edit }}
      girder-upsert-folder(
          :edit="true",
          :key="datum._id",
          :location="datum",
          @dismiss="showUpsert = false")
  girder-markdown.mx-3.mt-2(v-if="details && details.description", :text="details.description")
  girder-detail-list(title="Info", :rows="info")
  girder-detail-list(v-if="meta.length", title="Meta", :rows="meta")
    template(slot="row", slot-scope="props")
      v-layout(row, justify-space-between)
        v-flex(shrink) {{ props.datum.key }}
        v-flex(shrink) {{ props.datum.value }}
  girder-detail-list(v-if="files.length", :title="`Files (${files.length})`", :rows="files.map(f => f.name)")
  girder-detail-list(v-if="actions.length", title="Actions", :rows="actions", :color="$vuetify.theme.secondary.lighten5")
    v-layout(slot="row", slot-scope="props", column) 
      v-flex
        v-btn.ma-0.pl-0(flat, small, block,
            :color="props.datum.color",
            @click="handleAction(props.datum)")
          v-icon.pr-2 {{ $vuetify.icons[props.datum.icon] }}
          | {{ props.datum.name }}
</template>

<script>
import GirderDetailList from './Presentation/DetailList.vue';
import GirderMarkdown from './Markdown.vue';
import GirderUpsertFolder from './UpsertFolder.vue';
import { dateFormatter, sizeFormatter, usernameFormatter } from '../utils/mixins';

function download(baseurl, modelType, id, query = '') {
  if (['resource', 'folder', 'item', 'file'].indexOf(modelType) < 0) {
    throw new Error(`${modelType} is not downloadable`);
  }
  let idpart = id ? `${id}/` : '';
  let url = `${baseurl}/${modelType}/${idpart}download${query}`;
  window.open(url, '_blank');
}

export const DEFAULT_INFO_KEYS = [
  {
    value: 'size',
    name: 'Size: ',
    transform: sizeFormatter.methods.formatSize,
  },
  {
    value: 'created',
    name: 'Created on ',
    transform: dateFormatter.methods.formatDate,
  },
  {
    value: 'updated',
    name: 'Updated on ',
    transform: dateFormatter.methods.formatDate,
  },
  {
    value: '_id',
    name: 'Unique ID: ',
  },
];

export const DEFAULT_ACTION_KEYS = [
  {
    for: ['item'],
    name: 'View Item',
    icon: 'view',
    color: 'primary',
    handler(items, vue) {
      download(vue.girderRest.apiRoot, items[0]._modelType, items[0]._id, '?contentDisposition=inline');
    },
  },
  {
    for: ['item'],
    name: 'Download',
    icon: 'download',
    color: 'secondary',
    handler(items, vue) {
      download(vue.girderRest.apiRoot, items[0]._modelType, items[0]._id);
    },
  },
  {
    for: ['folder', 'multi'],
    name: 'Download (zip)',
    icon: 'download',
    color: 'secondary',
    handler(items, vue) {
      const lists = { item: [], folder: [] };
      items.forEach(item => lists[item._modelType].push(item._id));
      download(vue.girderRest.apiRoot, 'resource', null, `?resources=${JSON.stringify(lists)}`);
    },
  },
  {
    for: ['multi'],
    name: 'Bulk Move',
    icon: 'fileMove',
    color: 'secondary',
    handler(items) {
      alert('Bulk move unimplemented.');
    },
  },
  {
    for: ['item', 'folder', 'multi'],
    name: 'Delete',
    icon: 'delete',
    color: 'error',
    async handler(items, vue) {
      const lists = { item: [], folder: [] };
      items.forEach(item => lists[item._modelType].push(item._id));
      await vue.girderRest.delete('resource', {
        params: { resources: JSON.stringify(lists) },
      });
    },
  },
];

export default {
  components: {
    GirderDetailList,
    GirderMarkdown,
    GirderUpsertFolder,
  },
  props: {
    data: {
      required: true,
      type: Array,
    },
    infoKeys: {
      type: Array,
      default: () => DEFAULT_INFO_KEYS,
    },
    actionKeys: {
      type: Array,
      default: () => DEFAULT_ACTION_KEYS,
    },
  },
  data() {
    return {
      showUpsert: false,
    };
  },
  inject: ['girderRest'],
  mixins: [sizeFormatter, usernameFormatter],
  asyncComputed: {
    async details() {
      // Use created as a litmus text for the existence of the rest of the data model.
      // TODO: add proper model validation
      if (this.datum && this.datum.created) {
        return this.datum;
      } else if (this.datum) {
        const { data } = await this.girderRest.get(`${this.data[0]._modelType}/${this.data[0]._id}`);
        return data;
      }
      return null;
    },
    files: {
      default: [],
      async get() {
        if (this.datum && this.datum._modelType === 'item') {
          const { data } = await this.girderRest.get(`item/${this.datum._id}/files`);
          return data;
        }
        return [];
      },
    },
  },
  computed: {
    title() {
      return this.datum ? (this.datum.name || this.formatUsername(this.datum)) : `${this.data.length} Selections`;
    },
    datum() {
      return this.data.length === 1 ? this.data[0] : undefined;
    },
    icon() {
      return this.datum ? this.$vuetify.icons[this.datum._modelType] : this.$vuetify.icons.fileMultiple;
    },
    meta() {
      if (this.details && 'meta' in this.details) {
        return Object.keys(this.details.meta).map(k => ({
          key: k,
          value: this.details.meta[k],
        }));
      }
      return [];
    },
    info() {
      if (this.details) {
        /* If this is a single datum */
        return this.infoKeys.map((k) => {
          let val = this.details[k.value];
          if (k.transform) {
            val = k.transform(val);
          }
          return `${k.name}${val}`;
        });
      } else if (this.data.length > 1) {
        /* If this is a multi-selection */
        const reducer = (acc, curr) => {
          acc[curr._modelType] += 1;
          acc['size'] += curr.size;
          return acc;
        };
        const typeCounts = this.data.reduce(reducer, {
          item: 0,
          folder: 0,
          size: 0,
        });
        const countMessages = ['item', 'folder']
          .filter(k => typeCounts[k] > 0)
          .map(k => `${typeCounts[k]} ${k}(s) selected`);
        const sizeMessage = `Total size: ${this.formatSize(typeCounts['size'])}`;
        return [...countMessages, sizeMessage];
      }
      return [];
    },
    actions() {
      const actionType = this.datum ? this.datum._modelType : 'multi';
      return this.actionKeys.filter(k => k.for.includes(actionType));
    },
  },
  methods: {
    async handleAction(action) {
      await action.handler(this.data, this);
      this.$emit('action', action);
    }
  }
};
</script>

<style lang="scss" scoped>
.data-details {
  width: 100%;
}
.details-title {
  font-size: 16px;
}
</style>

<style lang="scss">
.data-details .v-toolbar__content {
  padding: 0 16px !important;
}
</style>
