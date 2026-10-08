import { describe, expect, it } from "vitest";
import { daysOfStockLeft, stockAlertFor } from "./inventory";

describe("stockAlertFor", () => {
  it("alerts once when crossing the low-stock line", () => {
    expect(stockAlertFor(6, 5, 5)).toBe("low");
    expect(stockAlertFor(5, 4, 5)).toBeNull();
    expect(stockAlertFor(20, 2, 5)).toBe("low");
  });

  it("alerts when it sells out, even jumping past the low line", () => {
    expect(stockAlertFor(3, 0, 5)).toBe("out");
    expect(stockAlertFor(10, 0, 5)).toBe("out");
    expect(stockAlertFor(0, 0, 5)).toBeNull();
  });

  it("stays quiet when units go up", () => {
    expect(stockAlertFor(2, 30, 5)).toBeNull();
  });
});

describe("daysOfStockLeft", () => {
  it("uses the last 30 days' pace", () => {
    expect(daysOfStockLeft(30, 30)).toBe(30);
    expect(daysOfStockLeft(10, 60)).toBe(5);
  });

  it("has no estimate without sales", () => {
    expect(daysOfStockLeft(10, 0)).toBeNull();
  });
});
