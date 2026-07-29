import { Container, Text } from 'pixi.js';
import Graph from '../graph';

export default class Bar {
    /**
     * @param {Graph} graph
     */
    constructor(graph) {
        this.graph = graph;
        this.label = new Text('');
        this.bar = new Container();
        this.height = 15;
    }

    setLabel(text, textStyle) {
        this.label.text = text;
        this.label.style = textStyle || {
            fontFamily: 'Roboto',
            fontSize: '13px',
            fontWeight: 'bold',
            fill: 0x888888,
        };
    }

    addBarElement(container) {
        this.bar.addChild(container);
    }
}

