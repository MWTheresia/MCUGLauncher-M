/**
 * 第三方前端上下文。
 *
 * 由启动器在加载前端包/目录时注入（官方内置界面为 null），只读、只做自描述，
 * 不能当作授权凭据。这里只取名字与模式，用来在界面上标明「当前跑的是哪套 UI」。
 */
export interface FrontendContext {
  name: string;
  version: string;
  mode: "directory" | "package";
}

interface RawContext {
  __MCUGL__?: {
    frontend?: {
      name?: string;
      version?: string;
      mode?: string;
    };
  };
}

export function currentFrontend(): FrontendContext | null {
  if (typeof window === "undefined") return null;
  const frontend = (window as unknown as RawContext).__MCUGL__?.frontend;
  if (!frontend?.name) return null;
  return {
    name: frontend.name,
    version: frontend.version ?? "",
    mode: frontend.mode === "package" ? "package" : "directory",
  };
}
