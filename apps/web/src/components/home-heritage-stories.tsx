"use client";

import { useState } from "react";
import { StoryCta } from "./analytics-content";
import { useExposure } from "@/lib/analytics-visibility";
import { heritageStories, type HeritageStory } from "@/lib/heritage-stories";
import { ProductImage } from "./product/product-image";
import styles from "./heritage-stories.module.css";

function StoryRow({
  story,
  reverse = false,
  revealOnScroll = true,
  enabled = true,
}: {
  story: HeritageStory;
  reverse?: boolean;
  revealOnScroll?: boolean;
  enabled?: boolean;
}) {
  const headingId = `heritage-${story.image.slug}`;
  const exposure = useExposure<HTMLDivElement>("view_story", { story_id: story.category, story_surface: "home", story_mode: story.category === "qua-bieu" ? "expanded" : "default" }, story.category, enabled);
  return (
    <article
      className={`gh-story__grid ${styles.row}${reverse ? ` ${styles.reverse}` : ""}`}
      aria-labelledby={headingId}
      data-home-reveal={revealOnScroll ? "" : undefined}
    >
      <div ref={exposure} className={`gh-story__copy ${styles.copy}`}>
        <span className="gh-kicker">{story.label}</span>
        <h2 id={headingId}>{story.shortTitle}</h2>
        <div className="gh-story__rule" aria-hidden="true" />
        <p>{story.summary[0]}</p>
        <p className="gh-story__muted">{story.summary[1]}</p>
        <StoryCta id={story.category} surface="home"
          className={`gh-btn ${reverse ? "gh-btn--brown gh-btn--fold" : "gh-btn--paper"}`}
          href={`/products?category=${story.category}`}
        >
          {story.linkLabel}
          <span className="gh-btn__arrow" aria-hidden="true">
            →
          </span>
        </StoryCta>
      </div>
      <div className={`gh-frame-plaque gh-story__photo ${styles.photo}`}>
        <ProductImage
          width={1344}
          height={756}
          sizes="(max-width: 960px) 90vw, 50vw"
          src={`/images/heritage/stories/${story.image.slug}.webp`}
          alt={story.image.alt}
        />
      </div>
    </article>
  );
}

export function HomeHeritageStories() {
  const [expanded, setExpanded] = useState(false);
  const [sesame, cakes, tea, gifts] = heritageStories;

  return (
    <div className={`gh-wrap ${styles.stories}`}>
      <StoryRow story={sesame} />
      <StoryRow story={cakes} reverse />
      <StoryRow story={tea} />
      <div className={styles.more}>
        <button
          type="button"
          className={styles.toggle}
          aria-label={
            expanded ? "Thu gọn câu chuyện Quà biếu" : "Xem câu chuyện Quà biếu"
          }
          aria-expanded={expanded}
          aria-controls="heritage-gift-story"
          onClick={() => setExpanded((open) => !open)}
        >
          <svg
            className={styles.chevron}
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          id="heritage-gift-story"
          className={styles.disclosure}
          data-expanded={expanded}
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <div className={styles.disclosureInner}>
            <StoryRow story={gifts} reverse revealOnScroll={false} enabled={expanded} />
          </div>
        </div>
      </div>
    </div>
  );
}
