<script>
import { stringify } from 'qs';

import JobTable from './JobTable.vue';
import FilterForm from './FilterForm.vue';

export default {
  inject: ['girderRest', 'notificationBus'],
  components: {
    JobTable,
    FilterForm,
  },
  data() {
    return {
      jobFilter: {
        fromDate: null,
        toDate: null,
        status: null,
        jobType: null,
      },
      pagination: {
        rowsPerPage: 10,
        page: 1,
        sortBy: 'updated',
        descending: true,
      },
      morePages: true,
      refresh: 0,
    };
  },
  watch: {
    // reset to the first page when the filter changes
    jobFilter: {
      handler() {
        this.pagination.page = 1;
      },
      deep: true,
    },
  },
  asyncComputed: {
    jobs: {
      async get() {
        // eslint-disable-next-line no-unused-expressions
        this.girderRest.user; // reload when the user changes
        // eslint-disable-next-line no-unused-expressions
        this.refresh; // reload when this value changes
        const pg = this.pagination;
        const params = {
          limit: pg.rowsPerPage + 1, // get one more than the requested limit to detect next page
          offset: pg.rowsPerPage * (pg.page - 1),
        };
        if (pg.sortBy) {
          params.sort = pg.sortBy;
          params.sortdir = pg.descending ? -1 : 1;
        }
        if (this.jobFilter.status !== null) {
          params.statuses = JSON.stringify([this.jobFilter.status]);
        }
        if (this.jobFilter.jobType !== null) {
          params.types = JSON.stringify([this.jobFilter.jobType]);
        }
        const resp = await this.girderRest.get(`job?${stringify(params)}`);
        // set the morePages prop on the data table and slice to real count
        if (resp.data.length < params.limit) {
          this.morePages = false;
        } else {
          this.morePages = true;
        }
        return resp.data.slice(0, pg.rowsPerPage);
      },
      default() {
        return [];
      },
    },
    typeAndStatusList: {
      async get() {
        // eslint-disable-next-line no-unused-expressions
        this.girderRest.user; // reload when the user changes
        const resp = await this.girderRest.get('job/typeandstatus');
        return resp.data;
      },
      default() {
        return {
          statuses: [],
          types: [],
        };
      },
    },
  },
  mounted() {
    // trigger a fetch when a job status update occurs
    this.refreshJobFunc = () => { this.refreshJobList(); };
    this.notificationBus.$on('message:job_status', this.refreshJobFunc);
    this.notificationBus.$on('message:job_created', this.refreshJobFunc);
  },
  beforeDestroy() {
    this.notificationBus.$off('message:job_status', this.refreshJobFunc);
    this.notificationBus.$off('message:job_created', this.refreshJobFunc);
  },
  methods: {
    refreshJobList() {
      // Vue with prevent the update happening more than once per animation frame,
      // but we might want to add an extra debounce to prevent excessive rest
      // calls.
      this.refresh += 1;
    },
  },
};
</script>

<template lang="pug">
.girder-job-list
  v-layout(row)
    v-flex(xs12)
      filter-form(
          :from-date.sync="jobFilter.fromDate",
          :to-date.sync="jobFilter.toDate",
          :status.sync="jobFilter.status",
          :job-type.sync="jobFilter.jobType",
          :status-list="typeAndStatusList.statuses",
          :job-type-list="typeAndStatusList.types")
  v-layout(row)
    v-flex(xs12)
      job-table(
          :jobs="jobs",
          :pagination.sync="pagination",
          :more-pages="morePages",
          @job-click="(e, job)=>$emit('job-click', e, job)")
</template>
