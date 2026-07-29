import { sprintf } from 'sprintf-js';

export default {
    rangeValue() {
        return '-';
    },
    value(frame) {
        return sprintf('%0.3f', this.graph.data['cmd']['upmove'][frame]);
    },
};

