import { sprintf } from 'sprintf-js';

const _formatTime = function (time) {
    var timeMillis = Math.floor(time * 100),
        hours = Math.floor(timeMillis / 360000),
        minutes = Math.floor(timeMillis / 6000) % 60,
        seconds = Math.floor(timeMillis / 100) % 60,
        milliseconds = timeMillis % 100;

    if (hours) {
        return sprintf('%02d:%02d:%02d.%02d', hours, minutes, seconds, milliseconds);
    }

    return sprintf('%02d:%02d.%02d', minutes, seconds, milliseconds);
};

export default {
    rangeValue(frameFrom, frameTo, mode) {
        var timeData = this.graph.data[mode === 1 ? 'demo_time' : 'time'],
            timeDiff = timeData[frameTo] - timeData[frameFrom];

        return _formatTime(timeDiff);
    },
    value(frame, mode) {
        var timeData = this.graph.data[mode === 1 ? 'demo_time' : 'time'],
            time = timeData[frame];

        return _formatTime(time);
    },
};

