"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_PROFILE, validateProfile } from "./profile-model";
import type { StudentProfile } from "./profile-model";

type ProfileContextValue = {
  profile: StudentProfile;
  updateProfile: (next: StudentProfile) => void;
  resetProfile: () => void;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);

// 프로필은 모든 화면에서 공유하며 현재는 메모리에만 보관한다.
export function StudentProfileProvider({ children, initialProfile = DEFAULT_PROFILE }: {
  children: ReactNode;
  initialProfile?: StudentProfile;
}) {
  const [storedProfile, setProfile] = useState<StudentProfile>(() => ({ ...initialProfile }));
  // 월 필드가 없었던 이전 화면의 메모리 상태도 2월로 읽는다.
  // 입학+3년보다 이른 이전 선택값은 새 선택 범위의 시작 연도로 맞춘다.
  const previousYear = Number.isInteger(storedProfile.graduationYear)
    ? storedProfile.graduationYear : storedProfile.admissionYear + 4;
  const profile: StudentProfile = {
    ...storedProfile,
    graduationYear: Math.max(previousYear, storedProfile.admissionYear + 3),
    graduationMonth: storedProfile.graduationMonth ?? 2,
  };
  function updateProfile(next: StudentProfile) {
    const error = validateProfile(next);
    if (error) throw new Error(error);
    setProfile({ ...next });
  }
  function resetProfile() { setProfile({ ...DEFAULT_PROFILE }); }
  return <ProfileContext.Provider value={{ profile, updateProfile, resetProfile }}>
    {children}
  </ProfileContext.Provider>;
}

export function useStudentProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("StudentProfileProvider로 화면을 감싸주세요.");
  return context;
}
