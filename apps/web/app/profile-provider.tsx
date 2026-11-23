"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_PROFILE, validateProfile, clampGraduationYear } from "./profile-model";
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
  // 예전의 긴 졸업 시기 선택값도 현재 표시 범위 안으로 맞춘다.
  const profile: StudentProfile = {
    ...storedProfile,
    graduationYear: clampGraduationYear(storedProfile.admissionYear, storedProfile.graduationYear),
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
