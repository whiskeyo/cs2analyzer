import type { ReactNode } from "react";
import { Credits } from "@/components/app/Credits";
import { RATING_CENTER, RATING_SPREAD_STD } from "@/lib/shared/constants";
import { MATCH_RATING_RANGES } from "@/lib/stats/rating";
import {
  densityToY,
  plotRect,
  ratingBandPath,
  ratingCurvePath,
  ratingGraphTicks,
  ratingNormalPdf,
  ratingRangeBounds,
  ratingRangeTone,
  ratingToX,
  RATING_GRAPH_LAYOUT,
  sampleRatingAxis,
} from "@/lib/stats/ratingGraph";

const RATING_GRAPH_SAMPLES = 192;
const RATING_GRAPH_STRIP_GAP = 6;
const RATING_GRAPH_STRIP_HEIGHT = 8;
const RATING_GRAPH_TICK_LENGTH = 4;
const RATING_GRAPH_READING_GAP = 16;
const RATING_GRAPH_TICK_LABEL_GAP = 22;

function ident(name: string): ReactNode {
  return name.length > 1 ? <mi mathvariant="normal">{name}</mi> : <mi>{name}</mi>;
}

function z(index: string): ReactNode {
  return (
    <msub>
      <mi>z</mi>
      <mtext>{index}</mtext>
    </msub>
  );
}

function times(a: ReactNode, b: ReactNode): ReactNode {
  return (
    <mrow>
      {a}
      <mo>×</mo>
      {b}
    </mrow>
  );
}

function minus(a: ReactNode, b: ReactNode): ReactNode {
  return (
    <mrow>
      {a}
      <mo>−</mo>
      {b}
    </mrow>
  );
}

function plus(...terms: ReactNode[]): ReactNode {
  const out: ReactNode[] = [];
  terms.forEach((term, i) => {
    if (i > 0) {
      out.push(<mo key={`p${i}`}>+</mo>);
    }
    out.push(<mrow key={i}>{term}</mrow>);
  });
  return <mrow>{out}</mrow>;
}

function frac(num: ReactNode, den: ReactNode): ReactNode {
  return (
    <mfrac>
      <mrow>{num}</mrow>
      <mrow>{den}</mrow>
    </mfrac>
  );
}

function call(name: string, ...args: ReactNode[]): ReactNode {
  const parts: ReactNode[] = [];
  args.forEach((arg, i) => {
    if (i > 0) {
      parts.push(<mo key={`c${i}`}>,</mo>, <mspace key={`s${i}`} width="0.35em" />);
    }
    parts.push(<mrow key={i}>{arg}</mrow>);
  });
  return (
    <mrow>
      {ident(name)}
      <mo>(</mo>
      {parts}
      <mo>)</mo>
    </mrow>
  );
}

function where(expr: ReactNode, ...defs: Array<[ReactNode, ReactNode]>): ReactNode {
  const parts: ReactNode[] = [
    <mrow key="expr">{expr}</mrow>,
    <mo key="comma">,</mo>,
    <mspace key="sp" width="0.5em" />,
    <mtext key="where">where</mtext>,
    <mspace key="sp2" width="0.35em" />,
  ];
  defs.forEach(([name, value], i) => {
    if (i > 0) {
      parts.push(<mo key={`d${i}`}>,</mo>, <mspace key={`ds${i}`} width="0.35em" />);
    }
    parts.push(
      <mrow key={i}>
        {name}
        <mo>=</mo>
        {value}
      </mrow>,
    );
  });
  return <mrow>{parts}</mrow>;
}

function MathBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rating-eq">
      <math display="block">{children}</math>
    </div>
  );
}

function EqTable({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <MathBlock>
      <mtable columnalign="right center left">
        {rows.map((row, i) => (
          <mtr key={i}>
            <mtd>
              <mrow>{row[0]}</mrow>
            </mtd>
            <mtd>
              <mo>=</mo>
            </mtd>
            <mtd>
              <mrow>{row[1]}</mrow>
            </mtd>
          </mtr>
        ))}
      </mtable>
    </MathBlock>
  );
}

const RATING_EQ = call(
  "max",
  <mn>1.00</mn>,
  call("round", plus(<mn>5.25</mn>, times(<mn>2.10</mn>, z("total"))), <mn>2</mn>),
);

function RatingGraph() {
  const layout = RATING_GRAPH_LAYOUT;
  const xs = sampleRatingAxis(RATING_GRAPH_SAMPLES);
  const plot = plotRect(layout);
  const baseline = plot.y + plot.height;
  const peak = ratingNormalPdf(RATING_CENTER);
  const expectedX = ratingToX(RATING_CENTER, layout);
  const expectedY = densityToY(peak, peak, layout);
  const stripY = baseline + RATING_GRAPH_STRIP_GAP;
  const readingY = stripY + RATING_GRAPH_STRIP_HEIGHT + RATING_GRAPH_READING_GAP;
  const labelY = readingY + RATING_GRAPH_TICK_LABEL_GAP;

  return (
    <figure className="rating-graph">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Expected rating ${RATING_CENTER.toFixed(2)} on a Gaussian with spread ${RATING_SPREAD_STD.toFixed(2)}, split into Poor through Outstanding.`}
      >
        {MATCH_RATING_RANGES.map((range) => {
          const tone = ratingRangeTone(range.label);
          const { min, max } = ratingRangeBounds(range);
          return (
            <g key={range.label}>
              <path
                className={`rating-band rating-band-${tone}`}
                d={ratingBandPath(range, xs, layout)}
              />
              <rect
                className={`rating-band rating-band-${tone}`}
                x={ratingToX(min, layout)}
                y={stripY}
                width={ratingToX(max, layout) - ratingToX(min, layout)}
                height={RATING_GRAPH_STRIP_HEIGHT}
              />
              <text
                className={`rating-graph-reading rating-graph-reading-${tone}`}
                x={(ratingToX(min, layout) + ratingToX(max, layout)) / 2}
                y={readingY}
                textAnchor="middle"
              >
                {range.label}
              </text>
            </g>
          );
        })}
        <path className="rating-graph-curve" d={ratingCurvePath(xs, layout)} />
        <line
          className="rating-graph-expected"
          x1={expectedX}
          y1={expectedY}
          x2={expectedX}
          y2={baseline}
        />
        <text
          className="rating-graph-expected-label"
          x={expectedX}
          y={layout.padTop - 8}
          textAnchor="middle"
        >
          expected {RATING_CENTER.toFixed(2)}
        </text>
        <line
          className="rating-graph-axis"
          x1={plot.x}
          y1={baseline}
          x2={plot.x + plot.width}
          y2={baseline}
        />
        {ratingGraphTicks().map((tick) => {
          const x = ratingToX(tick, layout);
          return (
            <g key={tick}>
              <line
                className="rating-graph-tick"
                x1={x}
                y1={baseline}
                x2={x}
                y2={baseline + RATING_GRAPH_TICK_LENGTH}
              />
              <text className="rating-graph-tick-label" x={x} y={labelY} textAnchor="middle">
                {tick.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function Rating() {
  return (
    <div className="home">
      <article className="rating">
        <h2>Rating</h2>
        <p className="rating-lead">
          This is a <strong>proprietary</strong> match rating developed by whiskeyo. It uses the
          same live scoreboard as the rest of the analyzer — kills, ADR, KAST, and so on — through
          the current playhead. Knife rounds are left out.
        </p>
        <p>
          The scale starts at <strong>1.00</strong> and has <strong>no ceiling</strong>. A typical
          game lands around <strong>5.25</strong>; a historic demo can print 10+.
        </p>

        <h3>Ranges</h3>
        <p>
          A typical line sits at <strong>{RATING_CENTER.toFixed(2)}</strong>, with a designed spread
          of about <strong>{RATING_SPREAD_STD.toFixed(2)}</strong>. The curve is that expected
          distribution; the dashed line is the typical game at the center. Use the bands as a
          reading guide, not hard cutoffs.
        </p>
        <RatingGraph />

        <h3>How it is calculated</h3>
        <p>
          Each box-score rate is turned into a standardized score{" "}
          <math display="inline">
            <mstyle displaystyle="true">
              <mrow>
                <mi>z</mi>
                <mo>=</mo>
                {frac(minus(<mi>x</mi>, ident("mean")), ident("std"))}
              </mrow>
            </mstyle>
          </math>
          . Four pillars mix those{" "}
          <math display="inline">
            <mi>z</mi>
          </math>{" "}
          values, then:
        </p>
        <MathBlock>
          <mrow>
            {ident("rating")}
            <mo>=</mo>
            {RATING_EQ}
          </mrow>
        </MathBlock>
        <p>
          There is a <strong>floor at 1.00</strong> and <strong>no ceiling</strong>, so a historic
          demo can print 10+. A line that sits on every reference mean is <strong>5.25</strong>.
        </p>
        <p>
          KAST is the 0–100 percentage already shown on the board. <code>rounds</code> is at least 1
          so a tick before the first freeze stays defined. Clutch terms are <strong>wins</strong>,
          not attempts. A 5-kill round is an ace.
        </p>

        <h3>Inputs</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Board field</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>R</code>
              </td>
              <td>Rounds</td>
              <td>Competitive rounds started by this tick</td>
            </tr>
            <tr>
              <td>
                <code>K</code>, <code>D</code>
              </td>
              <td>Kills, deaths</td>
              <td />
            </tr>
            <tr>
              <td>
                <code>ADR</code>
              </td>
              <td>ADR</td>
              <td>
                Enemy HP damage / <code>R</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>KAST</code>
              </td>
              <td>KAST</td>
              <td>0–100</td>
            </tr>
            <tr>
              <td>
                <code>FK</code>, <code>FD</code>
              </td>
              <td>First kills, first deaths</td>
              <td>Opening duel of the round</td>
            </tr>
            <tr>
              <td>
                <code>2K</code>…<code>5K</code>
              </td>
              <td>Multikills</td>
              <td>
                <code>5K</code> = aces
              </td>
            </tr>
            <tr>
              <td>
                <code>TG</code>, <code>TW</code>
              </td>
              <td>Trades (got / was)</td>
              <td>5-second teammate trade window</td>
            </tr>
            <tr>
              <td>
                <code>UD</code>
              </td>
              <td>Utility damage</td>
              <td>HE / molotov / inferno, same ADR cap</td>
            </tr>
            <tr>
              <td>
                <code>FA</code>
              </td>
              <td>Flash assists</td>
              <td />
            </tr>
            <tr>
              <td>
                <code>C1</code>…<code>C5</code>
              </td>
              <td>Clutch 1v1–1v5</td>
              <td>Wins</td>
            </tr>
            <tr>
              <td>
                <code>P</code>, <code>Def</code>
              </td>
              <td>Plants, defuses</td>
              <td>Completed</td>
            </tr>
          </tbody>
        </table>

        <h3>1. Firepower (45%)</h3>
        <EqTable
          rows={[
            [
              z("kd"),
              where(
                frac(minus(ident("KPR"), ident("DPR")), <mn>0.30</mn>),
                [ident("KPR"), frac(ident("K"), ident("R"))],
                [ident("DPR"), frac(ident("D"), ident("R"))],
              ),
            ],
            [z("adr"), frac(minus(ident("ADR"), <mn>75</mn>), <mn>18</mn>)],
            [z("firepower"), plus(times(<mn>0.6</mn>, z("kd")), times(<mn>0.4</mn>, z("adr")))],
          ]}
        />

        <h3>2. Impact (25%)</h3>
        <EqTable
          rows={[
            [z("entry"), frac(frac(minus(ident("FK"), ident("FD")), ident("R")), <mn>0.12</mn>)],
            [
              ident("mk"),
              frac(
                plus(
                  times(<mn>1</mn>, ident("2K")),
                  times(<mn>2.5</mn>, ident("3K")),
                  times(<mn>5</mn>, ident("4K")),
                  times(<mn>8</mn>, ident("5K")),
                ),
                ident("R"),
              ),
            ],
            [z("multi"), frac(minus(ident("mk"), <mn>0.25</mn>), <mn>0.20</mn>)],
            [z("impact"), plus(times(<mn>0.5</mn>, z("entry")), times(<mn>0.5</mn>, z("multi")))],
          ]}
        />

        <h3>3. Support (18%)</h3>
        <EqTable
          rows={[
            [z("kast"), frac(minus(ident("KAST"), <mn>70</mn>), <mn>12</mn>)],
            [
              ident("trade"),
              frac(
                plus(ident("TG"), ident("TW")),
                call("max", plus(ident("K"), ident("D")), <mn>1</mn>),
              ),
            ],
            [z("trades"), frac(minus(ident("trade"), <mn>0.35</mn>), <mn>0.15</mn>)],
            [
              ident("util"),
              where(plus(frac(ident("UDPR"), <mn>10</mn>), frac(ident("FA"), ident("R"))), [
                ident("UDPR"),
                frac(ident("UD"), ident("R")),
              ]),
            ],
            [z("util"), frac(minus(ident("util"), <mn>0.70</mn>), <mn>0.40</mn>)],
            [
              z("support"),
              plus(
                times(<mn>0.5</mn>, z("kast")),
                times(<mn>0.3</mn>, z("trades")),
                times(<mn>0.2</mn>, z("util")),
              ),
            ],
          ]}
        />

        <h3>4. Clutch and objective (12%)</h3>
        <EqTable
          rows={[
            [
              ident("clutch"),
              frac(
                plus(
                  times(<mn>1</mn>, ident("C1")),
                  times(<mn>2</mn>, ident("C2")),
                  times(<mn>3.5</mn>, ident("C3")),
                  times(<mn>5.5</mn>, ident("C4")),
                  times(<mn>8</mn>, ident("C5")),
                ),
                ident("R"),
              ),
            ],
            [z("clutch"), frac(ident("clutch"), <mn>0.06</mn>)],
            [
              ident("obj"),
              frac(
                plus(times(<mn>0.8</mn>, ident("P")), times(<mn>1.2</mn>, ident("Def"))),
                ident("R"),
              ),
            ],
            [z("obj"), frac(minus(ident("obj"), <mn>0.10</mn>), <mn>0.10</mn>)],
            [
              z("clutch_obj"),
              plus(times(<mn>0.7</mn>, z("clutch")), times(<mn>0.3</mn>, z("obj"))),
            ],
          ]}
        />
        <p>
          <math display="inline">{z("clutch")}</math> has mean 0 (no subtraction). Plants weigh less
          than defuses.
        </p>

        <h3>Combined score</h3>
        <EqTable
          rows={[
            [
              z("total"),
              plus(
                times(<mn>0.45</mn>, z("firepower")),
                times(<mn>0.25</mn>, z("impact")),
                times(<mn>0.18</mn>, z("support")),
                times(<mn>0.12</mn>, z("clutch_obj")),
              ),
            ],
            [ident("rating"), RATING_EQ],
          ]}
        />
        <p>
          The player detail pane shows the four pillar{" "}
          <math display="inline">
            <mi>z</mi>
          </math>{" "}
          values next to rating. Half-up rounding to two decimals, then the floor.
        </p>

        <h3>Reference means</h3>
        <p>
          These mean / std values are the “typical game” the z-scores are built around. They are not
          live match averages.
        </p>
        <table>
          <thead>
            <tr>
              <th>Rate</th>
              <th>Mean</th>
              <th>Std</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>KPR − DPR</code>
              </td>
              <td>0</td>
              <td>0.30</td>
            </tr>
            <tr>
              <td>
                <code>ADR</code>
              </td>
              <td>75</td>
              <td>18</td>
            </tr>
            <tr>
              <td>
                <code>(FK − FD) / R</code>
              </td>
              <td>0</td>
              <td>0.12</td>
            </tr>
            <tr>
              <td>
                <code>mk</code>
              </td>
              <td>0.25</td>
              <td>0.20</td>
            </tr>
            <tr>
              <td>
                <code>KAST</code>
              </td>
              <td>70</td>
              <td>12</td>
            </tr>
            <tr>
              <td>
                <code>trade</code>
              </td>
              <td>0.35</td>
              <td>0.15</td>
            </tr>
            <tr>
              <td>
                <code>util</code>
              </td>
              <td>0.70</td>
              <td>0.40</td>
            </tr>
            <tr>
              <td>
                <code>clutch</code>
              </td>
              <td>0</td>
              <td>0.06</td>
            </tr>
            <tr>
              <td>
                <code>obj</code>
              </td>
              <td>0.10</td>
              <td>0.10</td>
            </tr>
          </tbody>
        </table>

        <h3>Worked example</h3>
        <p>
          20 rounds, 10–10, ADR 75, KAST 70%, five 2Ks, 4 trades got / 3 was, 140 utility damage,
          one plant and one defuse, no opening duels or clutch wins:
        </p>
        <EqTable
          rows={[
            [
              <mrow key="pillars">
                {z("firepower")}
                <mo>=</mo>
                {z("impact")}
                <mo>=</mo>
                {z("support")}
                <mo>=</mo>
                {z("clutch_obj")}
              </mrow>,
              <mn key="zero">0</mn>,
            ],
            [z("total"), <mn key="zt">0</mn>],
            [ident("rating"), <mn key="r">5.25</mn>],
          ]}
        />
        <p>That is the center of the scale on purpose.</p>
      </article>
      <Credits />
    </div>
  );
}
