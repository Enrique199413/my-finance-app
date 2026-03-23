// Utility for generating a color palette
// Simple HSL or hex mixing to generate tailwind-like 50 to 950 scale.

function hexToRgb(hex: string) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function mixColors(color1: number[], color2: number[], weight: number): [number, number, number] {
    return [
        color1[0] * weight + color2[0] * (1 - weight),
        color1[1] * weight + color2[1] * (1 - weight),
        color1[2] * weight + color2[2] * (1 - weight)
    ];
}


export function generatePalette(baseHex: string): Record<string, string> {
    const baseRgb = hexToRgb(baseHex);
    const white = [255, 255, 255];
    const black = [0, 0, 0];
    
    // Tailwind scale is typically:
    // 50: 95% white, 5% base
    // 100: 90% white, 10% base
    // 200: 75% white, 25% base
    // ...
    // 500: 100% base
    // ...
    // 900: 80% black, 20% base
    // 950: 90% black, 10% base

    const palette: Record<string, string> = {
        '50': rgbToHex(...mixColors(baseRgb, white, 0.05)),
        '100': rgbToHex(...mixColors(baseRgb, white, 0.1)),
        '200': rgbToHex(...mixColors(baseRgb, white, 0.25)),
        '300': rgbToHex(...mixColors(baseRgb, white, 0.4)),
        '400': rgbToHex(...mixColors(baseRgb, white, 0.7)),
        '500': baseHex, // 100% Base
        '600': rgbToHex(...mixColors(baseRgb, black, 0.85)), // Black mix gets tricky, so invert weight. 85% base, 15% black
        '700': rgbToHex(...mixColors(baseRgb, black, 0.7)),
        '800': rgbToHex(...mixColors(baseRgb, black, 0.55)),
        '900': rgbToHex(...mixColors(baseRgb, black, 0.4)),
        '950': rgbToHex(...mixColors(baseRgb, black, 0.25))
    };

    return palette;
}
