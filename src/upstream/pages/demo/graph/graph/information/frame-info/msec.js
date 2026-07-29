import { sprintf } from 'sprintf-js';

export default {
    rangeValue(frameFrom, frameTo) {
        var slice = this.graph.data['cmd']['msec'].slice(frameFrom, frameTo + 1),
            msecFpsOk = 0,
            msecFpsLow = 0,
            msecFpsHigh = 0;

        slice.forEach(function (msec) {
            if (msec >= 13) {
                msecFpsLow++;
            } else if (msec < 10) {
                msecFpsHigh++;
            } else {
                msecFpsOk++;
            }
        });

        return sprintf('%0.1f%% ≥ 83 fps', msecFpsOk / slice.length * 100);
    },
    value(frame) {
        return this.graph.data['cmd']['msec'][frame];
    },
};

