/* Montador de Masmorras — seletor de cor (componente reaproveitado do ÁrvoreNós).
   Script clássico: expõe window.ColorPicker = { PRESET_COLORS, create }. */
'use strict';

(function () {

  /** Cores fixas oferecidas como atalho, na mesma ordem da ferramenta de nós */
  var PRESET_COLORS = [
    { name: 'Vermelho', value: '#ef4444' },
    { name: 'Magenta', value: '#d946ef' },
    { name: 'Roxo', value: '#8b5cf6' },
    { name: 'Anil', value: '#6366f1' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Ciano', value: '#06b6d4' },
    { name: 'Verde', value: '#22c55e' },
    { name: 'Lima', value: '#84cc16' },
    { name: 'Amarelo', value: '#eab308' },
    { name: 'Laranja', value: '#f97316' }
  ];

  // #region Conversões de cor
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** Converte "#rrggbb" em canais { r, g, b } (0–255). */
  function hexToRgb(hex) {
    const value = hex.replace('#', '');
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  /** Converte canais 0–255 em "#rrggbb". */
  function rgbToHex(r, g, b) {
    const channel = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
    return '#' + channel(r) + channel(g) + channel(b);
  }

  /** Converte canais 0–255 em { h: 0–360, s: 0–1, v: 0–1 }. */
  function rgbToHsv(r, g, b) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === red) hue = ((green - blue) / delta) % 6;
      else if (max === green) hue = (blue - red) / delta + 2;
      else hue = (red - green) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }

    return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
  }

  /** Converte { h, s, v } em canais 0–255. */
  function hsvToRgb(h, s, v) {
    const chroma = v * s;
    const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const base = v - chroma;

    let rgb;
    if (h < 60) rgb = [chroma, second, 0];
    else if (h < 120) rgb = [second, chroma, 0];
    else if (h < 180) rgb = [0, chroma, second];
    else if (h < 240) rgb = [0, second, chroma];
    else if (h < 300) rgb = [second, 0, chroma];
    else rgb = [chroma, 0, second];

    return { r: (rgb[0] + base) * 255, g: (rgb[1] + base) * 255, b: (rgb[2] + base) * 255 };
  }

  /** Aceita "#abc" ou "#aabbcc" (com ou sem "#") e devolve "#aabbcc" — ou null. */
  function normalizeHex(text) {
    const value = String(text).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(value)) {
      return ('#' + value[0] + value[0] + value[1] + value[1] + value[2] + value[2]).toLowerCase();
    }
    if (/^[0-9a-f]{6}$/i.test(value)) return ('#' + value).toLowerCase();
    return null;
  }

  function hsvFromHex(hex) {
    const rgb = hexToRgb(hex);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  }
  // #endregion

  // #region Seletor
  /** Seletor de cor aberto no momento (apenas um por vez). */
  let activePicker = null;

  function closeActivePicker() {
    if (activePicker) activePicker.close();
  }

  document.addEventListener('pointerdown', function (event) {
    if (activePicker && !activePicker.root.contains(event.target)) closeActivePicker();
  }, true);

  /**
   * Troca um <input type="hidden"> por um seletor de cor próprio: amostra da cor,
   * código hexadecimal editável e painel HSV em um popover.
   *
   * O input original continua guardando o valor — quem lê `input.value` segue
   * funcionando, e as escritas programáticas são interceptadas para que o painel
   * acompanhe a cor atual.
   */
  function create(input) {
    const nativeValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');

    const root = document.createElement('div');
    root.className = 'picker';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'picker__chip';
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-label', 'Abrir seletor de cor');

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'picker__hex';
    hexInput.spellcheck = false;
    hexInput.autocomplete = 'off';
    hexInput.maxLength = 7;
    hexInput.setAttribute('aria-label', 'Código hexadecimal');

    const pop = document.createElement('div');
    pop.className = 'picker__pop';
    pop.hidden = true;

    const area = document.createElement('div');
    area.className = 'picker__area';
    const areaThumb = document.createElement('span');
    areaThumb.className = 'picker__thumb';
    area.append(areaThumb);

    const hue = document.createElement('div');
    hue.className = 'picker__hue';
    const hueThumb = document.createElement('span');
    hueThumb.className = 'picker__thumb';
    hue.append(hueThumb);

    pop.append(area, hue);
    root.append(chip, hexInput, pop);
    input.parentNode.insertBefore(root, input);
    input.hidden = true;

    let hsv = hsvFromHex(input.value || '#e8873c');
    let internal = false;

    function render() {
      const hex = input.value;
      root.style.setProperty('--picker-color', hex);
      root.style.setProperty('--picker-hue', 'hsl(' + Math.round(hsv.h) + ' 100% 50%)');
      if (document.activeElement !== hexInput) hexInput.value = hex;
      areaThumb.style.left = (hsv.s * 100) + '%';
      areaThumb.style.top = ((1 - hsv.v) * 100) + '%';
      hueThumb.style.left = ((hsv.h / 360) * 100) + '%';
    }

    /** Grava o valor no input e avisa os ouvintes (bolinhas de cor, etc.). */
    function commit(hex) {
      input.value = hex;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /** Aplica um código hexadecimal: o HSV é recalculado a partir dele. */
    function setFromHex(hex) {
      commit(hex);
    }

    /** Aplica o HSV atual preservando o matiz (evita saltos em cores neutras). */
    function updateFromHsv() {
      const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
      internal = true;
      commit(rgbToHex(rgb.r, rgb.g, rgb.b));
      internal = false;
    }

    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return nativeValue.get.call(input);
      },
      set(value) {
        nativeValue.set.call(input, value);
        if (!internal) hsv = hsvFromHex(nativeValue.get.call(input));
        render();
      }
    });

    function trackDrag(element, apply) {
      let pointerId = null;

      element.addEventListener('pointerdown', function (event) {
        pointerId = event.pointerId;
        try {
          element.setPointerCapture(pointerId);
        } catch (error) {
          /* ignore */
        }
        apply(event);
        event.preventDefault();
      });

      element.addEventListener('pointermove', function (event) {
        if (pointerId === null || event.pointerId !== pointerId) return;
        apply(event);
        event.preventDefault();
      });

      function end(event) {
        if (pointerId === null || event.pointerId !== pointerId) return;
        try {
          element.releasePointerCapture(pointerId);
        } catch (error) {
          /* ignore */
        }
        pointerId = null;
      }

      element.addEventListener('pointerup', end);
      element.addEventListener('pointercancel', end);
    }

    trackDrag(area, function (event) {
      const rect = area.getBoundingClientRect();
      hsv = {
        h: hsv.h,
        s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        v: 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1)
      };
      updateFromHsv();
    });

    trackDrag(hue, function (event) {
      const rect = hue.getBoundingClientRect();
      hsv = {
        h: clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360,
        s: hsv.s,
        v: hsv.v
      };
      updateFromHsv();
    });

    hexInput.addEventListener('input', function () {
      const hex = normalizeHex(hexInput.value);
      if (hex) setFromHex(hex);
    });

    hexInput.addEventListener('blur', function () {
      hexInput.value = input.value;
    });

    hexInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      hexInput.blur();
    });

    const instance = {
      root: root,
      close() {
        setOpen(false);
      }
    };

    function setOpen(open) {
      if (open) {
        if (activePicker && activePicker !== instance) activePicker.close();
        pop.hidden = false;
        chip.setAttribute('aria-expanded', 'true');
        activePicker = instance;

        // Abre para cima quando não há espaço abaixo.
        pop.classList.remove('picker__pop--up');
        if (pop.getBoundingClientRect().bottom > window.innerHeight - 8) {
          pop.classList.add('picker__pop--up');
        }
      } else {
        pop.hidden = true;
        chip.setAttribute('aria-expanded', 'false');
        if (activePicker === instance) activePicker = null;
      }
    }

    chip.addEventListener('click', function () {
      setOpen(pop.hidden);
    });

    render();
    return instance;
  }
  // #endregion

  window.ColorPicker = { PRESET_COLORS: PRESET_COLORS, create: create };
})();
