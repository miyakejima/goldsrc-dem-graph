import { sprintf } from 'sprintf-js';

export default {
    rangeValue() {
        return '-';
    },
    value(frame) {
        return sprintf('%d', this.graph.data['cd']['fuser2'].getAt(frame));
    },
};

