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
      container.appendChild(svg);
    } catch (err) {
      container.createEl("pre", { text: `DOT/SVG rendering error: ${err}` });
    }
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
  }
} 