import { sprintf } from 'sprintf-js';

export default {
    rangeValue(frameFrom, frameTo) {
        var slice = this.graph.data['cmd']['msec'].slice(frameFrom, frameTo + 1),
            sum = 0;

        slice.forEach(function (msec) {
            sum += msec ? 1000 / msec : 0;
        });

        return sprintf('%2d', sum / slice.length);
    },
    value(frame) {
        return sprintf('%2d', this.graph.data['cmd']['msec'][frame]
            ? 1000 / this.graph.data['cmd']['msec'][frame]
            : 0);
    },
};

