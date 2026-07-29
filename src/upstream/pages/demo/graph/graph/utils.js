export function getActiveFramesRanges(totalFrames, isActiveFunc) {
    let startFrame = null;
    let frameRanges = [];

    for (let frame = 1; frame <= totalFrames; frame++) {
        const isActive = isActiveFunc(frame);

        if (isActive && startFrame === null) {
            startFrame = frame;
        } else if (startFrame !== null && (!isActive || frame === totalFrames)) {
            frameRanges.push([startFrame, !isActive ? frame - 1 : frame]);
            startFrame = null;
        }
    }

    return frameRanges;
}

export function getCommandLinesFrames(totalFrames, lineColorFn) {
    var frame, color, frames = [];

    for (frame = 1; frame <= totalFrames; frame++) {
        color = lineColorFn(frame);

        if (color !== undefined) {
            frames.push([frame, color]);
        }
    }

    return frames;
}

