import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Kakao Maps API types
declare global {
  interface Window {
    kakao: {
      maps: {
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement | null, options: unknown) => {
          getCenter: () => { getLat: () => number; getLng: () => number };
          setCenter: (position: unknown) => void;
        };
        Circle: new (options: unknown) => {
          setMap: (map: unknown | null) => void;
        };
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void;
        };
        load: (callback: () => void) => void;
      };
    };
    ReactNativeWebView?: {
      postMessage: (msg: string) => void;
    };
  }
}
