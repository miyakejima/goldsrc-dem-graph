import { Container, Graphics, Point, Text } from 'pixi.js';
import Graph from '../../graph';

export default class GraphicsBase {
    /**
     * @param {Graph} graph
     */
    constructor(graph) {
        this.graph = graph;
        this.active = false;

        this.graphicsContainer = new Container();
        this.labelsContainer = new Container();
        this.lines = new Graphics();

        graph.on('init', () => this.baseInit());
    }

    position() {
        return new Point(0, 15);
    }

    baseInit() {
        const { app, graphic, gui } = this.graph;

        app.stage.addChildAt(this.lines, 0);
        graphic.addChild(this.graphicsContainer);
        gui.addChild(this.labelsContainer);

        this.graphicsContainer.position = this.position();
        app.stage.toLocal(this.graphicsContainer, graphic, this.lines.position);
        this.labelsContainer.position.set(0, app.stage.toLocal(this.graphicsContainer, graphic).y);
    }

    registerSwitcher(label) {
        this.graph.graphicsSwitcher.add(this, label, [this.graphicsContainer, this.lines, this.labelsContainer]);
    }

    activate() {
        this.active = true;

        this.onActivate();
    }

    deactivate() {
        this.active = false;

        this.onDeactivate();
    }

    onActivate() {
    }

    onDeactivate() {
    }

    drawLabelAndLine(labelText, labelColor, lineColor, offsetY) {
        const label = new Text(labelText, {
            fontFamily: 'Roboto',
            fontSize: '13px',
            fontWeight: 'bold',
            fill: labelColor,
            lineHeight: 16,
            align: 'right',
        });

        label.position.set(75, offsetY);
        label.anchor.set(1, 1);

        this.labelsContainer.addChild(label);

        this.lines.lineStyle(1, lineColor, 1);
        this.lines.moveTo(0, offsetY);
        this.lines.lineTo(this.graph.renderer.width, offsetY);
    }

    /**
     * @param {Array} values
     * @returns {IterableIterator<Array>}
     */
    * getSequence(values) {
        let sequenceValue = null;
        let sequenceStartIndex = 0;
        let currentValue;
        let index;

        for (index in values) {
            index = Number(index);
            currentValue = values[index];

            if (index !== 0 && sequenceValue !== currentValue) {
                yield [sequenceValue, sequenceStartIndex, index - 1];

                sequenceStartIndex = index;
            }

            sequenceValue = currentValue;
        }

        if (sequenceValue !== null) {
            yield [sequenceValue, sequenceStartIndex, index];
        }
    }
}


