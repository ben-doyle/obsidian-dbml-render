import { App, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting } from "obsidian";
import { parse } from "@softwaretechnik/dbml-renderer/lib/parser";
import { check } from "@softwaretechnik/dbml-renderer/lib/checker";
import { render as dbmlRender } from "@softwaretechnik/dbml-renderer/lib/renderer";
import Viz from "viz.js";
import { Module, render } from "viz.js/full.render.js";
import { DbmlRenderSettings, DEFAULT_SETTINGS } from "./settings";

export default class DbmlRenderPlugin extends Plugin {
  settings?: DbmlRenderSettings;
  viz: Viz | null = null;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.viz = new Viz({ Module, render });
    this.registerMarkdownCodeBlockProcessor("dbml", this.dbmlProcessor.bind(this));
    this.addSettingTab(new DbmlRenderSettingTab(this.app, this));
  }

  async dbmlProcessor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const container = el.createDiv({ cls: "dbml-render-container" });
    container.style.position = "relative";
    let dot: string;
    try {
      // Parse and check DBML, then generate DOT
      const ast = parse(source);
      const checked = check(ast);
      dot = dbmlRender(checked, "dot");
    } catch (err) {
      container.createEl("pre", { text: `DBML parsing error: ${err}` });
      return;
    }
    try {
      // Render SVG from DOT
      if (!this.viz) {
        this.viz = new Viz({ Module, render });
      }
      const svg = await this.viz.renderSVGElement(dot);
      this.applySvgStyles(svg);
      // Create scroll area and zoom wrapper so controls can overlay without moving
      const scrollArea = container.createDiv({ cls: "dbml-scroll-area" });
      const zoomWrapper = scrollArea.createDiv({ cls: "dbml-zoom-wrapper" });
      zoomWrapper.style.transformOrigin = "0 0";
      zoomWrapper.appendChild(svg);
      // Compute initial zoom
      let currentScale = this.computeInitialScale(scrollArea, svg);
      this.applyScale(zoomWrapper, currentScale);
      if (this.settings?.showZoomControls) {
        const controls = this.createZoomControls(() => {
          currentScale = this.clampScale(currentScale + (this.settings?.zoomStep ?? 0.05));
          this.applyScale(zoomWrapper, currentScale);
        }, () => {
          currentScale = this.clampScale(currentScale - (this.settings?.zoomStep ?? 0.05));
          this.applyScale(zoomWrapper, currentScale);
        }, () => {
          currentScale = this.clampScale(1);
          this.applyScale(zoomWrapper, currentScale);
        }, () => {
          currentScale = this.computeFitScale(scrollArea, svg);
          this.applyScale(zoomWrapper, currentScale);
        });
        container.appendChild(controls);
      }
      if (this.settings?.enableWheelZoom) {
        const requireMod = this.settings?.wheelZoomRequiresModifier ?? true;
        scrollArea.addEventListener('wheel', (ev: WheelEvent) => {
          const modifierHeld = ev.ctrlKey || ev.metaKey;
          if (requireMod && !modifierHeld) return;
          ev.preventDefault();
          const delta = Math.sign(ev.deltaY);
          const step = this.settings?.zoomStep ?? 0.1;
          currentScale = this.clampScale(currentScale * (delta > 0 ? (1 - step) : (1 + step)));
          this.applyScale(zoomWrapper, currentScale);
        }, { passive: false });
      }

      // Drag-to-pan with mouse while preserving two-finger scroll for trackpads
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let startScrollLeft = 0;
      let startScrollTop = 0;
      scrollArea.addEventListener('mousedown', (ev: MouseEvent) => {
        if (ev.button !== 0) return; // left button
        // Ignore clicks on controls
        if ((ev.target as HTMLElement).closest('.dbml-zoom-controls')) return;
        isPanning = true;
        panStartX = ev.clientX;
        panStartY = ev.clientY;
        startScrollLeft = scrollArea.scrollLeft;
        startScrollTop = scrollArea.scrollTop;
        scrollArea.classList.add('is-panning');
      });
      scrollArea.addEventListener('mousemove', (ev: MouseEvent) => {
        if (!isPanning) return;
        const dx = ev.clientX - panStartX;
        const dy = ev.clientY - panStartY;
        scrollArea.scrollLeft = startScrollLeft - dx;
        scrollArea.scrollTop = startScrollTop - dy;
      });
      const endPan = () => {
        if (!isPanning) return;
        isPanning = false;
        scrollArea.classList.remove('is-panning');
      };
      scrollArea.addEventListener('mouseleave', endPan);
      scrollArea.addEventListener('mouseup', endPan);
    } catch (err) {
      container.createEl("pre", { text: `DOT/SVG rendering error: ${err}` });
    }
  }

  computeInitialScale(container: HTMLElement, svg: SVGElement): number {
    if (this.settings?.fitToWidthOnLoad) {
      return this.computeFitWidthScale(container, svg);
    }
    return this.clampScale(this.settings?.initialZoom ?? 1);
  }

  computeFitWidthScale(container: HTMLElement, svg: SVGElement): number {
    const rectWidth = container.getBoundingClientRect().width || 0;
    const cs = getComputedStyle(container);
    const padLeft = parseFloat(cs.paddingLeft || '0');
    const padRight = parseFloat(cs.paddingRight || '0');
    const availableWidth = Math.max(0, rectWidth - padLeft - padRight);

    const svgWidthAttr = svg.getAttribute('width');
    let svgWidthPx = 0;
    if (svgWidthAttr) {
      const trimmed = svgWidthAttr.trim();
      if (trimmed.endsWith('pt')) {
        svgWidthPx = parseFloat(trimmed) * (96 / 72); // convert points to pixels
      } else if (trimmed.endsWith('px')) {
        svgWidthPx = parseFloat(trimmed);
      } else if (/^[0-9.]+$/.test(trimmed)) {
        svgWidthPx = parseFloat(trimmed);
      }
    }
    if (svgWidthPx === 0) {
      // Fallback to bounding box, which is already in CSS pixels
      svgWidthPx = svg.getBoundingClientRect().width || 0;
    }
    if (svgWidthPx === 0 || availableWidth === 0) return this.clampScale(this.settings?.initialZoom ?? 1);
    const scale = availableWidth / svgWidthPx;
    return this.clampScale(scale);
  }

  computeFitScale(container: HTMLElement, svg: SVGElement): number {
    const rect = container.getBoundingClientRect();
    const cs = getComputedStyle(container);
    const padLeft = parseFloat(cs.paddingLeft || '0');
    const padRight = parseFloat(cs.paddingRight || '0');
    const padTop = parseFloat(cs.paddingTop || '0');
    const padBottom = parseFloat(cs.paddingBottom || '0');
    const availableWidth = Math.max(0, rect.width - padLeft - padRight);
    const availableHeight = Math.max(0, rect.height - padTop - padBottom);

    // Read SVG intrinsic size (pt or px)
    let w = 0;
    let h = 0;
    const wAttr = svg.getAttribute('width');
    const hAttr = svg.getAttribute('height');
    if (wAttr) {
      const t = wAttr.trim();
      if (t.endsWith('pt')) w = parseFloat(t) * (96 / 72); else if (t.endsWith('px')) w = parseFloat(t); else if (/^[0-9.]+$/.test(t)) w = parseFloat(t);
    }
    if (hAttr) {
      const t = hAttr.trim();
      if (t.endsWith('pt')) h = parseFloat(t) * (96 / 72); else if (t.endsWith('px')) h = parseFloat(t); else if (/^[0-9.]+$/.test(t)) h = parseFloat(t);
    }
    if (w === 0 || h === 0) {
      // Fallback to bounding box in CSS pixels
      const bbox = svg.getBoundingClientRect();
      if (w === 0) w = bbox.width || 0;
      if (h === 0) h = bbox.height || 0;
    }
    if (w === 0 || h === 0 || availableWidth === 0 || availableHeight === 0) {
      return this.clampScale(this.settings?.initialZoom ?? 1);
    }
    const scaleX = availableWidth / w;
    const scaleY = availableHeight / h;
    return this.clampScale(Math.min(scaleX, scaleY));
  }

  clampScale(value: number): number {
    const min = this.settings?.minZoom ?? 0.25;
    const max = this.settings?.maxZoom ?? 3;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  applyScale(wrapper: HTMLElement, scale: number) {
    wrapper.style.transform = `scale(${scale})`;
  }

  createZoomControls(onZoomIn: () => void, onZoomOut: () => void, onReset: () => void, onFit: () => void): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'dbml-zoom-controls';
    const btnOut = document.createElement('button');
    btnOut.textContent = 'Zoom −';
    btnOut.className = 'dbml-zoom-btn';
    btnOut.addEventListener('click', onZoomOut);
    const btnIn = document.createElement('button');
    btnIn.textContent = 'Zoom +';
    btnIn.className = 'dbml-zoom-btn';
    btnIn.addEventListener('click', onZoomIn);
    const btnReset = document.createElement('button');
    btnReset.textContent = 'Default Zoom';
    btnReset.className = 'dbml-zoom-btn';
    btnReset.addEventListener('click', onReset);
    const btnFit = document.createElement('button');
    btnFit.textContent = 'Fit to window';
    btnFit.className = 'dbml-zoom-btn';
    btnFit.addEventListener('click', onFit);
    // Order: + - Reset Fit
    controls.appendChild(btnIn);
    controls.appendChild(btnOut);
    controls.appendChild(btnReset);
    controls.appendChild(btnFit);
    return controls;
  }

  applySvgStyles(svg: SVGElement) {
    // Apply user settings as inline styles or CSS variables
    svg.style.fontFamily = this.settings?.font || 'var(--font-text)';
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      .dbml-render-container svg {
        font-family: ${this.settings?.font || 'var(--font-text)'};
        color: ${this.settings?.textColor || 'var(--text-normal)'};
      }
      .dbml-render-container svg [stroke] {
        stroke: ${this.settings?.strokeColor || 'var(--background-modifier-border)'};
      }
      .dbml-render-container svg [fill="#1d71b8"] {
        fill: ${this.settings?.headerColor || 'var(--background-modifier-active-hover)'};
      }
      .dbml-render-container svg [fill="#e7e2dd"] {
        fill: ${this.settings?.rowAltColor || 'var(--background-secondary)'};
      }
      .dbml-render-container svg text {
        fill: ${this.settings?.textColor || 'var(--text-normal)'};
      }
    `;
    svg.prepend(style);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

const OBSIDIAN_FONTS = [
  'var(--font-text)',
  'var(--font-interface)',
  'var(--font-monospace)',
  'Inter',
  'Segoe UI',
  'SF Pro',
  'system-ui',
  'Arial',
  'Helvetica',
  'sans-serif',
];

class DbmlRenderSettingTab extends PluginSettingTab {
  plugin: DbmlRenderPlugin;
  constructor(app: App, plugin: DbmlRenderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "DBML Render Settings" });

    // Font dropdown
    new Setting(containerEl)
      .setName("Font")
      .setDesc("Font family for diagram text.")
      .addDropdown(drop => {
        OBSIDIAN_FONTS.forEach(font => drop.addOption(font, font));
        drop.setValue(this.plugin.settings?.font || 'var(--font-text)');
        drop.onChange(async (value) => {
          this.plugin.settings!.font = value;
          await this.plugin.saveSettings();
        });
      });

    // Header color
    new Setting(containerEl)
      .setName("Header Color")
      .setDesc("Color of table headers.")
      .addColorPicker(color => {
        color.setValue(this.plugin.settings?.headerColor || 'var(--background-modifier-active-hover)');
        color.onChange(async (value) => {
          this.plugin.settings!.headerColor = value;
          await this.plugin.saveSettings();
        });
      })
      .addText(text => text
        .setPlaceholder("var(--background-modifier-active-hover)")
        .setValue(this.plugin.settings?.headerColor || 'var(--background-modifier-active-hover)')
        .onChange(async (value) => {
          this.plugin.settings!.headerColor = value;
          await this.plugin.saveSettings();
        }));

    // Text color
    new Setting(containerEl)
      .setName("Text Color")
      .setDesc("Color of diagram text.")
      .addColorPicker(color => {
        color.setValue(this.plugin.settings?.textColor || 'var(--text-normal)');
        color.onChange(async (value) => {
          this.plugin.settings!.textColor = value;
          await this.plugin.saveSettings();
        });
      })
      .addText(text => text
        .setPlaceholder("var(--text-normal)")
        .setValue(this.plugin.settings?.textColor || 'var(--text-normal)')
        .onChange(async (value) => {
          this.plugin.settings!.textColor = value;
          await this.plugin.saveSettings();
        }));

    // Alternating row color
    new Setting(containerEl)
      .setName("Alternating Row Color")
      .setDesc("Color for alternating table rows.")
      .addColorPicker(color => {
        color.setValue(this.plugin.settings?.rowAltColor || 'var(--background-secondary)');
        color.onChange(async (value) => {
          this.plugin.settings!.rowAltColor = value;
          await this.plugin.saveSettings();
        });
      })
      .addText(text => text
        .setPlaceholder("var(--background-secondary)")
        .setValue(this.plugin.settings?.rowAltColor || 'var(--background-secondary)')
        .onChange(async (value) => {
          this.plugin.settings!.rowAltColor = value;
          await this.plugin.saveSettings();
        }));

    // Stroke color
    new Setting(containerEl)
      .setName("Stroke Color")
      .setDesc("Color of table borders.")
      .addColorPicker(color => {
        color.setValue(this.plugin.settings?.strokeColor || 'var(--background-modifier-border)');
        color.onChange(async (value) => {
          this.plugin.settings!.strokeColor = value;
          await this.plugin.saveSettings();
        });
      })
      .addText(text => text
        .setPlaceholder("var(--background-modifier-border)")
        .setValue(this.plugin.settings?.strokeColor || 'var(--background-modifier-border)')
        .onChange(async (value) => {
          this.plugin.settings!.strokeColor = value;
          await this.plugin.saveSettings();
        }));

    // Zoom controls
    new Setting(containerEl)
      .setName("Initial Zoom")
      .setDesc("Initial zoom level (e.g., 1 = 100%).")
      .addText(text => text
        .setPlaceholder("1")
        .setValue(String(this.plugin.settings?.initialZoom ?? 1))
        .onChange(async (value) => {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) this.plugin.settings!.initialZoom = parsed;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Min/Max Zoom")
      .setDesc("Minimum and maximum zoom scale.")
      .addText(text => text
        .setPlaceholder("0.25")
        .setValue(String(this.plugin.settings?.minZoom ?? 0.25))
        .onChange(async (value) => {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) this.plugin.settings!.minZoom = parsed;
          await this.plugin.saveSettings();
        }))
      .addText(text => text
        .setPlaceholder("3")
        .setValue(String(this.plugin.settings?.maxZoom ?? 3))
        .onChange(async (value) => {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) this.plugin.settings!.maxZoom = parsed;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Zoom Step")
      .setDesc("Step size for each zoom in/out.")
      .addText(text => text
        .setPlaceholder("0.1")
        .setValue(String(this.plugin.settings?.zoomStep ?? 0.1))
        .onChange(async (value) => {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) this.plugin.settings!.zoomStep = parsed;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Enable wheel zoom")
      .setDesc("Allow zooming with mouse wheel. Hold Ctrl/Cmd if required.")
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings?.enableWheelZoom ?? true);
        toggle.onChange(async (value) => {
          this.plugin.settings!.enableWheelZoom = value;
          await this.plugin.saveSettings();
        });
      })
      .addToggle(toggle => {
        toggle.setTooltip("Require Ctrl/Cmd for wheel zoom");
        toggle.setValue(this.plugin.settings?.wheelZoomRequiresModifier ?? true);
        toggle.onChange(async (value) => {
          this.plugin.settings!.wheelZoomRequiresModifier = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show zoom controls")
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings?.showZoomControls ?? true);
        toggle.onChange(async (value) => {
          this.plugin.settings!.showZoomControls = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Fit to width on load")
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings?.fitToWidthOnLoad ?? true);
        toggle.onChange(async (value) => {
          this.plugin.settings!.fitToWidthOnLoad = value;
          await this.plugin.saveSettings();
        });
      });
  }
} 