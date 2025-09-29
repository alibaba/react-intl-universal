import React from "react";
import intl, { ReactIntlUniversal } from "../src/index";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";
import enUSMore from "./locales/en-US-more";
import LocalStorageMock from "./util/LocalStorageMock";
global.localStorage = new LocalStorageMock;
const dataKey = 'data-i18n-key';

const locales = {
  "en-US": enUS,
  "zh-CN": zhCN,
};

test("Set specific locale", () => {
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(intl.get("SIMPLE")).toBe("简单");
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("SIMPLE")).toBe("Simple");
});

test("Change specific locale", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("SIMPLE")).toBe("Simple");
  intl.changeCurrentLocale("zh-CN");
  expect(intl.get("SIMPLE")).toBe("简单");
});

test("Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("HELLO", { name: "Tony" })).toBe("Hello, Tony");
});

test("Message with brace", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("BRACE1")).toBe("The format is {var}");
  expect(intl.get("BRACE2")).toBe("The format is ${var}");
});

test("Set specific locale with nested notation", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("NESTED.HELLO")).toBe("Hello World");
  expect(intl.get("NESTED.HELLO_NAME", { name: "World" })).toBe("Hello, World");
});

test("react-intl mirror API formatMessage:variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  const name = "Tony";
  expect(
    intl.formatMessage(
      { id: "HELLO", defaultMessage: `Hello, {name}` },
      { name }
    )
  ).toBe(intl.get("HELLO", { name }));
});

test("react-intl mirror API formatMessage:defaultMessage", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.formatMessage({ id: "not-exist-key" })).toBe(
    intl.get("not-exist-key")
  );
});

test("react-intl mirror API formatHTMLMessage:variable", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.formatHTMLMessage(
    { id: "TIP_VAR", defaultMessage: React.createElement("div") },
    {
      message: "your message"
    }
  );
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>your message</span>"
  );
});

test("react-intl mirror API formatHTMLMessage:defaultMessage", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.formatHTMLMessage({
    id: "not-exist-key",
    defaultMessage: React.createElement("div", { className: 'test' })
  });

  expect(reactEl.type).toBe('div');
  expect(reactEl.props.className).toBe('test');

});

test("HTML Message without variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP");
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is <span>HTML</span>"
  );
});

test("HTML Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR", { message: "your message" });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>your message</span>"
  );
});

test("HTML Message without variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP");
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is <span>HTML</span>"
  );
});

test("HTML Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR", {
    message: "your message"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>your message</span>"
  );
});

test("HTML Message with XSS attack", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR", {
    message: "<sctipt>alert(1)</script>"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>&lt;sctipt&gt;alert(1)&lt;/script&gt;</span>"
  );
});

test("HTML Message with disable escape html", () => {
  intl.init({ locales, currentLocale: "en-US", escapeHtml: false });
  let reactEl = intl.getHTML("TIP_VAR", {
    message: "<sctipt>alert(1)</script>"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span><sctipt>alert(1)</script></span>"
  );
});

test("Message with Date", () => {
  let start = new Date("Fri Apr 07 2017 17:08:33");
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("SALE_START", {
      start: start
    })
  ).toBe("Sale begins 4/7/2017");
  expect(
    intl.get("SALE_END", {
      start: start
    })
  ).toBe("Sale begins April 7, 2017");
});

test("Message with Time", () => {
  let expires = new Date("Fri Apr 07 2017 17:08:33");
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("COUPON", {
      expires: expires
    })
  ).toBe("Coupon expires at 5:08:33 PM");
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(
    intl.get("COUPON", {
      expires: expires
    })
  ).toBe("优惠卷将在17:08:33过期");
});

test("Message with Currency", () => {
  let price = 123456.78;
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("SALE_PRICE", {
      price: price
    })
  ).toBe("The price is $123,456.78");
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(
    intl.get("SALE_PRICE", {
      price: price
    })
  ).toBe("售价¥123,456.78");
});

test("Message with plural", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("PHOTO", {
      num: 0
    })
  ).toBe("You have no photos.");
  expect(
    intl.get("PHOTO", {
      num: 1
    })
  ).toBe("You have one photo.");
  expect(
    intl.get("PHOTO", {
      num: 10
    })
  ).toBe("You have 10 photos.");

  intl.init({ locales, currentLocale: "zh-CN" });
  expect(
    intl.get("PHOTO", {
      num: 1
    })
  ).toBe("你有1张照片");
});

test("Message with skeleton", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("SKELETON_VAR", {
      value: 42.5
    })
  ).toBe("Increase by 42.5");

  expect(
    intl.get("SKELETON_VAR", {
      value: 42
    })
  ).toBe("Increase by 42.0");

  expect(
    intl.get("SKELETON_VAR", {
      value: 42.109
    })
  ).toBe("Increase by 42.11");

  expect(
    intl.get("SKELETON_SELECTORDINAL", {
      year: 2
    })
  ).toBe("It's my cat's 2nd birthday!");

  expect(
    intl.get("SKELETON_SELECTORDINAL", {
      year: 10
    })
  ).toBe("It's my cat's 10th birthday!");
})

test("Without default message, just return empty string", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("not-exist-key")).toBe("");
});

test("Should call handler when message is not defined", () => {
  const warningHandler = jest.fn();
  intl.init({
    locales, currentLocale: "en-US",
    warningHandler
  });
  intl.get("not-exist-key");
  expect(warningHandler).lastCalledWith('react-intl-universal key \"not-exist-key\" not defined in en-US');
});

test("Default message", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("not-exist-key").defaultMessage("this is default msg")).toBe(
    "this is default msg"
  );
  expect(intl.get("not-exist-key").d("this is default msg")).toBe(
    "this is default msg"
  );
});

test("Default message with nested key", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("NOT_EXIST_KEY.HELLO").defaultMessage("Hello World")).toBe("Hello World");
});

test("Default message", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("not-exist-key").defaultMessage("this is default msg")).toBe(
    "this is default msg"
  );
});

test("Default HTML message", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.getHTML("not-exist-key").defaultMessage("this is default msg")
  ).toBe("this is default msg");
});

test("Get locale from cookie", () => {
  document.cookie = "lang=en-US";
  document.cookie = "other=1";
  expect(intl.getLocaleFromCookie({ cookieLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from localStorage", () => {
  localStorage.setItem("lang", "en-US");
  expect(intl.getLocaleFromLocalStorage({ localStorageLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from URL", () => {
  expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBe(undefined);

  window.history.pushState({}, '', `?lang=en-US`);
  expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from browser", () => {
  expect(intl.getLocaleFromBrowser()).toBe("en-US");
});

test("Determine Locale", () => {
  expect(intl.determineLocale()).toBe("en-US");
  document.cookie = "lang=zh-CN";
  document.cookie = "other=1";
  expect(intl.determineLocale({ cookieLocaleKey: "lang" })).toBe("zh-CN");
});

test("Get dot key variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("DOT.HELLO")).toBe("Hello World");
});

test("Get init options", () => {
  intl.init({ locales, currentLocale: "en-US" });
  const { currentLocale } = intl.getInitOptions();
  expect(currentLocale).toBe("en-US");
});

test("load mutiple locale data without overriding existing one", () => {
  intl.init({ locales, currentLocale: "en-US" });
  const localesMore = {
    "en-US": enUSMore,
  };
  intl.load(localesMore);
  expect(intl.get("SIMPLE")).toBe("Simple");
  expect(intl.get("MORE")).toBe("More data");
});

test("Uses fallback locale if key not found in currentLocale", () => {
  intl.init({ locales, currentLocale: "zh-CN", fallbackLocale: "en-US" });
  expect(intl.get("ONLY_IN_ENGLISH")).toBe("ONLY_IN_ENGLISH");
});

test("Uses default message if key not found in fallbackLocale", () => {
  intl.init({ locales, currentLocale: "zh-CN", fallbackLocale: "en-US" });
  expect(intl.get("not-exist-key").defaultMessage("this is default msg")).toBe("this is default msg");
});

test("Resolve language url if currentLocale was matched", async () => {
  const result = await intl.init({ locales, currentLocale: "en" });
  expect(result).toBe(undefined);
});

test("Resolve directly if the environment is not browser", async () => {
  const createElement = window.document.createElement;
  Object.defineProperty(window.document, 'createElement', {
    writable: true,
    configurable: true,
    value: undefined,
  });
  jest.resetModules();
  const { default: ReactIntlUniversal } = await require('../src/ReactIntlUniversal');
  const nextIntl = new ReactIntlUniversal();
  const result = await nextIntl.init({ locales, currentLocale: "zh-CN" });
  Object.defineProperty(window.document, 'createElement', {
    writable: true,
    configurable: true,
    value: createElement,
  });
  expect(result).toBe(undefined);
});

describe("Exceptional cases", () => {
  let innerIntl;
  beforeEach(() => {
    innerIntl = new ReactIntlUniversal();
  });
  test("should call intl.init before render", () => {
    const warningHandler = jest.spyOn(console, 'warn');
    innerIntl.get("SIMPLE");
    expect(warningHandler).toHaveBeenCalledWith(`react-intl-universal locales data \"null\" not exists.Check if the key \"SIMPLE\" is used before it is initialized. More info: https://github.com/alibaba/react-intl-universal/issues/144#issuecomment-1345193138`);
  });
})

describe("Test for debug mode", () => {
  let innerIntl;
  beforeEach(() => {
    innerIntl = new ReactIntlUniversal();
  });
  test("should output key by using get method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });
    expect(innerIntl.get("SIMPLE").props[dataKey]).toBe("SIMPLE");
  });
  test("should output string by using get method if debug mode is false", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: false });
    expect(innerIntl.get("SIMPLE")).toBe("简单");
  });
  test("should output key by using getHTML method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });
    expect(innerIntl.getHTML("TIP").props[dataKey]).toBe("TIP");
  });
  test("should return original DOM without key by using getHTML method if debug mode is false", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: false });
    expect(innerIntl.getHTML("TIP").props[dataKey]).toBeUndefined();
  });
  test("should return html with variables by using getHTML method if debug mode is false", () => {
    innerIntl.init({ locales, currentLocale: "en-US", debug: false });
    let reactEl = innerIntl.getHTML("TIP_VAR", {
      message: "your message"
    });
    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is<span>your message</span>"
    );
  });
  test("should return html with variables by using getHTML method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "en-US", debug: true });
    const reactEl = innerIntl.getHTML("TIP_VAR", {
      message: "your message"
    });
    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is<span>your message</span>"
    );
    expect(reactEl.props[dataKey]).toBe("TIP_VAR");
  });
  test("should return html without variables by using getHTML method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "en-US", debug: true });
    let reactEl = innerIntl.getHTML("TIP");
    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is <span>HTML</span>"
    );

    expect(reactEl.props[dataKey]).toBe("TIP");
  });
  test("should has defaultMessage method in after get calling", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });
    expect(innerIntl.get("TIP").d).not.toBeUndefined();
  });
});


describe("Test for formatList", () => {
  const element = React.createElement("div", { className: 'test' });

  test("formatList should format string array correctly with en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ])).toEqual([
      'str1',
      ', ',
      'str2',
      ', ',
      'str3',
    ]);
  });

  test("formatList should format string array with disjunction type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "disjunction"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', or ',
      'str3',
    ]);
  });

  test("formatList should format React component array correctly with en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      element,
    ])).toEqual([
      "str1",
      ", ",
      "str2",
      ", ",
      element,
    ]);
  });

  test("formatList should format string array correctly with zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ])).toEqual([
      'str1',
      '、',
      'str2',
      '、',
      'str3',
    ]);
  });

  test("formatList should format React component array correctly with zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatList([
      "str1",
      "str2",
      element,
    ])).toEqual([
      "str1",
      '、',
      "str2",
      '、',
      element,
    ]);
  });

  test("formatList should format string array with conjunction type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "conjunction"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', and ',
      'str3',
    ]);
  });

  test("formatList should format string array with unit type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "unit"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', ',
      'str3',
    ]);
  });

  test("formatList should format string array with short style correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      style: "short"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', & ',
      'str3',
    ]);
  });

  test("formatList should format string array with narrow style correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      style: "narrow"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', ',
      'str3',
    ]);
  });

  test("formatList should format string array with combination of type and style options", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "disjunction",
      style: "short"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', or ',
      'str3',
    ]);
  });

  test("formatList should handle empty array correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([])).toEqual([]);
  });

  test("formatList should handle single element array correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList(["str1"])).toEqual(["str1"]);
  });

  test("formatList should handle two element array correctly with en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
    ])).toEqual([
      'str1',
      ', ',
      'str2',
    ]);
  });

  test("formatList should handle two element array correctly with zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatList([
      "str1",
      "str2",
    ])).toEqual([
      'str1',
      '、',
      'str2',
    ]);
  });

  test("formatList should handle two element array with disjunction type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
    ], {
      type: "disjunction"
    })).toEqual([
      'str1',
      ' or ',
      'str2',
    ]);
  });

  test("formatList should format string array correctly with ja-JP locale", () => {
    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ])).toEqual([
      'str1',
      '、',
      'str2',
      '、',
      'str3',
    ]);
  });

  test("formatList should format React component array correctly with ja-JP locale", () => {
    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatList([
      "str1",
      "str2",
      element,
    ])).toEqual([
      "str1",
      '、',
      "str2",
      '、',
      element,
    ]);
  });

  test("formatList should handle two element array correctly with ja-JP locale", () => {
    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatList([
      "str1",
      "str2",
    ])).toEqual([
      'str1',
      '、',
      'str2',
    ]);
  });

});


describe("Test for getColon", () => {
  beforeEach(() => {
    intl.init({ locales, currentLocale: "en-US" });
  });

  test("should return half-width colon for non-full-width locales", () => {
    expect(intl.getColon()).toEqual(": ");
  });

  test("should return full-width colon for full-width locales", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.getColon()).toEqual("：");

    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.getColon()).toEqual("：");

    intl.init({ locales, currentLocale: "ko-KR" });
    expect(intl.getColon()).toEqual("：");
  });
});


describe("Test for formatParentheses", () => {
  beforeEach(() => {
    intl.init({ locales, currentLocale: "en-US" });
  });

  test("should return half-width parentheses for non-full-width locales", () => {
    expect(intl.formatParentheses("test")).toEqual(["(", "test", ")"]);
  });

  test("should return full-width parentheses for full-width locales", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatParentheses("test")).toEqual(["（", "test", "）"]);

    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatParentheses("test")).toEqual(["（", "test", "）"]);

    intl.init({ locales, currentLocale: "ko-KR" });
    expect(intl.formatParentheses("test")).toEqual(["（", "test", "）"]);
  });

  test("should handle different input types", () => {
    expect(intl.formatParentheses("")).toEqual(["(", "", ")"]);
    expect(intl.formatParentheses(123)).toEqual(["(", 123, ")"]);
    expect(intl.formatParentheses(null)).toEqual(["(", null, ")"]);
  });
});


describe("Test for formatNumber", () => {

  test("should format number correctly for en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatNumber(1234567)).toBe("1,234,567");
    expect(intl.formatNumber(1234.567)).toBe("1,234.567");
    expect(intl.formatNumber(0)).toBe("0");
  });

  test("should format number correctly for zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatNumber(1234567)).toBe("1,234,567");
    expect(intl.formatNumber(1234.567)).toBe("1,234.567");
    expect(intl.formatNumber(0)).toBe("0");
  });

  test("should format number correctly for de-DE locale", () => {
    intl.init({ locales, currentLocale: "de-DE" });
    expect(intl.formatNumber(1234.567)).toBe("1.234,567");
  });

  test("should format number correctly for fr-FR locale", () => {
    intl.init({ locales, currentLocale: "fr-FR" });
    expect(intl.formatNumber(1234.567)).toBe("1 234,567");
  });

  test("should handle edge cases", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatNumber(NaN)).toBeNaN();
    // Intl.NumberFormat formats Infinity as "∞" string
    expect(intl.formatNumber(Infinity)).toBe("∞");
    expect(intl.formatNumber(-Infinity)).toBe("-∞");
    expect(intl.formatNumber(null)).toBeNull();
    expect(intl.formatNumber(undefined)).toBeUndefined();
    expect(intl.formatNumber("not a number")).toBe("not a number");
  });

  test("should handle large numbers", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatNumber(1e15)).toBe("1,000,000,000,000,000");
  });
});
