// Works order signature geometry.
//
//   npm test
//
// These guard the one thing that fails silently and expensively: a field placed
// somewhere other than the box the contractor can see.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  captionBottom,
  DATE_BOX_LEFT,
  SIGNATURE_BLOCK,
  topLeftY,
  WORKS_ORDER_PAGE,
  worksOrderSignatureFields,
} from "./worksOrderFields.ts";

describe("topLeftY", () => {
  it("converts a bottom-origin box to a top-origin one", () => {
    // react-pdf measures from the bottom; BoldSign from the top.
    assert.equal(topLeftY(78, 56), WORKS_ORDER_PAGE.height - 78 - 56);
  });

  it("puts a box at the page bottom furthest down the page", () => {
    assert.ok(topLeftY(0, 56) > topLeftY(700, 56));
  });
});

describe("worksOrderSignatureFields", () => {
  const fields = worksOrderSignatureFields(1);

  it("places a signature and a date field", () => {
    assert.deepEqual(
      fields.map((f) => f.type),
      ["Signature", "DateSigned"]
    );
  });

  it("puts both fields on the page it is told to", () => {
    for (const page of [1, 2, 5]) {
      for (const field of worksOrderSignatureFields(page)) {
        assert.equal(field.pageNumber, page);
      }
    }
  });

  it("matches the drawn boxes' left edges", () => {
    // The same constants the stylesheet positions the boxes with.
    assert.equal(fields[0].x, SIGNATURE_BLOCK.left);
    assert.equal(fields[1].x, DATE_BOX_LEFT);
  });

  it("sits both fields on the same baseline", () => {
    assert.equal(fields[0].y, fields[1].y);
  });

  it("derives y from the boxes' own bottom, not the caption's", () => {
    // The bug this replaced: wrapping box + caption in one positioned block
    // made `bottom` refer to the caption, dropping the field below its box.
    assert.equal(
      fields[0].y,
      WORKS_ORDER_PAGE.height - SIGNATURE_BLOCK.bottom - SIGNATURE_BLOCK.signature.height
    );
  });

  it("keeps both fields inside the page", () => {
    for (const field of fields) {
      assert.ok(field.x >= 0, "x off the left edge");
      assert.ok(field.y >= 0, "y off the top edge");
      assert.ok(field.x + field.width <= WORKS_ORDER_PAGE.width, "runs off the right edge");
      assert.ok(field.y + field.height <= WORKS_ORDER_PAGE.height, "runs off the bottom edge");
    }
  });

  it("does not overlap the two fields", () => {
    const [signature, date] = fields;
    assert.ok(
      signature.x + signature.width <= date.x,
      "the signature box runs into the date box"
    );
  });

  it("leaves enough reserved space that flowing content cannot overlap them", () => {
    // The captions sit above the boxes, so the whole block occupies
    // bottom → captionBottom + caption height. Page padding must clear it.
    const blockTop = captionBottom(SIGNATURE_BLOCK.signature.height) + 8;
    assert.ok(
      SIGNATURE_BLOCK.reservedBottomSpace >= blockTop,
      `reservedBottomSpace ${SIGNATURE_BLOCK.reservedBottomSpace} must clear the block top ${blockTop}`
    );
  });

  it("keeps the captions clear of their boxes", () => {
    const boxTop = SIGNATURE_BLOCK.bottom + SIGNATURE_BLOCK.signature.height;
    assert.ok(captionBottom(SIGNATURE_BLOCK.signature.height) >= boxTop);
  });

  it("marks both fields required", () => {
    for (const field of fields) assert.equal(field.isRequired, true);
  });
});
