import { Container, Graphics, Point, Text } from 'pixi.js';

export default class GraphicsSwitcher {
    constructor(graph) {
        this.graph = graph;

        this.switcherContainer = new Container();
        this.border = new Graphics();
        this.switchers = [];
        this.height = 30;

        graph.on('init', () => this.init());
        graph.on('resize', () => this.resize());
    }

    init() {
        this.switcherContainer.addChild(this.border);
        this.switcherContainer.position = new Point(80, 127);

        this.graph.gui.addChild(this.switcherContainer);
    }

    add(graphic, label, displayObjects) {
        const text = new Text(label, {
            fontFamily: 'Roboto',
            fontSize: '16px',
            fill: 0xFFFFFF,
        });

        let me = this;

        const switcher = {
            label: text,
            graphic: graphic,
            displayObjects: displayObjects,
            state: {
                active: false,
                hover: false,
            },
            disable() {
                this.state.active = false;

                this.displayObjects.forEach(function (displayObject) {
                    displayObject.renderable = false;
                });

                me.updateStyles(this);

                this.graphic.deactivate.call(this.graphic);
            },
            enable() {
                this.state.active = true;

                this.displayObjects.forEach(function (displayObject) {
                    displayObject.renderable = true;
                });

                me.updateStyles(this);

                this.graphic.activate.call(this.graphic);
            },
        };

        text.eventMode = 'static';
        text.cursor = 'pointer';
        text.position.y = Math.floor((this.height - 16) / 2);
        text.on('click', event => this.onLabelClick(event));
        text.on('pointerenter', this.onPointerEnter, this);
        text.on('pointerout', this.onPointerOut, this);

        if (this.switchers.length) {
            var lastSwitcher = this.switchers[this.switchers.length - 1].label;

            text.position.x = lastSwitcher.position.x + lastSwitcher.width + 20;
            switcher.disable();
        } else {
            text.position.x = 10;
            switcher.enable();
        }

        this.switcherContainer.addChild(text);
        this.switchers.push(switcher);
    }

    updateStyles(switcher) {
        let { state, label } = switcher;

        if (state.active) {
            label.alpha = 1;
            label.tint = 0x00FFFF;

            return;
        }

        if (state.hover) {
            label.alpha = 1;
            label.tint = 0xFFFF00;

            return;
        }

        label.alpha = 0.5;
        label.tint = 0xFFFFFF;
    }

    resize() {
        this.redraw();
    }

    redraw() {
        this.border.clear();
        this.border.lineStyle(1, 0x888888, 1);
        this.border.moveTo(0, this.height);
        this.border.lineTo(this.graph.renderer.width, this.height);
    }

    onLabelClick(event) {
        const label = event.target;

        this.switchers.forEach(function (switcher) {
            if (switcher.label === label && !switcher.state.active) {
                switcher.enable();
            } else if (switcher.label !== label && switcher.state.active) {
                switcher.disable();
            }
        });
    }

    onPointerEnter(event) {
        const label = event.target;

        let switcher = this.findSwitcherByLabel(label);
        if (switcher) {
            switcher.state.hover = true;

            this.updateStyles(switcher);
        }
    }

    onPointerOut(event) {
        const label = event.target;

        let switcher = this.findSwitcherByLabel(label);
        if (switcher) {
            switcher.state.hover = false;

            this.updateStyles(switcher);
        }
    }

    findSwitcherByLabel(label) {
        return this.switchers.find(switcher => switcher.label === label);
    }
};

