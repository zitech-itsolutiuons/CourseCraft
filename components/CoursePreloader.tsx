"use client";

import { useEffect, useState } from "react";

const title = "CYBERSECURITY 200LVL";

export default function CoursePreloader() {
  const [typedText, setTypedText] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timers: number[] = [];
    const finish = () => {
      setLeaving(true);
      timers.push(window.setTimeout(() => setVisible(false), 300));
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedText(title);
      timers.push(window.setTimeout(finish, 250));
    } else {
      let characterIndex = 0;
      const typingTimer = window.setInterval(() => {
        characterIndex += 1;
        setTypedText(title.slice(0, characterIndex));

        if (characterIndex >= title.length) {
          window.clearInterval(typingTimer);
          timers.push(window.setTimeout(finish, 280));
        }
      }, 48);

      return () => {
        window.clearInterval(typingTimer);
        timers.forEach(window.clearTimeout);
      };
    }

    return () => timers.forEach(window.clearTimeout);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`course-preloader${leaving ? " course-preloader--leaving" : ""}`}
      role="status"
      aria-label="Loading Cybersecurity 200lvl"
    >
      <div className="course-preloader__content">
        <span className="course-preloader__brand">COURSE CRAFT</span>
        <h1 className="course-preloader__title" aria-hidden="true">
          <span>{typedText.slice(0, 13)}</span>
          {typedText.length > 13 && (
            <span className="course-preloader__level">{typedText.slice(13)}</span>
          )}
          <span className="course-preloader__cursor" />
        </h1>
        <div className="course-preloader__track" aria-hidden="true">
          <span
            className="course-preloader__progress"
            style={{ transform: `scaleX(${typedText.length / title.length})` }}
          />
        </div>
      </div>
    </div>
  );
}