type AnyUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  monthlyStatus?: string;
  membershipExpiresAt?: Date | string | null;
  phone?: string | null;
  profilePicture?: string | null;
  classReminderEnabled?: boolean;
  createdAt?: Date | string;
};

type AnyClass = {
  id: number;
  title: string;
  description?: string | null;
  classTypeId?: number;
  teacherId?: number;
  maxCapacity?: number;
  startsAt?: Date | string;
  endsAt?: Date | string;
  imageUrl?: string | null;
  teacher?: AnyUser | null;
  classType?: { id: number; name: string; imageUrl?: string | null } | null;
  reservations?: Array<{
    id?: number;
    userId?: number;
    classId?: number;
    user?: AnyUser | null;
    status?: string;
    requestedAt?: Date | string;
    promotedAt?: Date | string | null;
    hideName?: boolean;
    fixedEnrollment?: boolean;
  }>;
  _count?: { reservations?: number };
};

type AnyClassType = {
  id: number;
  name: string;
  imageUrl?: string | null;
};

type UrlResolver = (value?: string | null) => string | null;

type ClassDtoOptions = {
  absoluteUrl?: UrlResolver;
  effectiveImageUrl?: string | null;
  viewerRole?: "ADMIN" | "TEACHER" | "CLIENT";
  viewerUserId?: number;
};

export function userDto(user: AnyUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    monthlyStatus: user.monthlyStatus,
    estado_mensualidad: user.monthlyStatus,
    membershipExpiresAt: user.membershipExpiresAt ?? null,
    membership_expires_at: user.membershipExpiresAt ?? null,
    phone: user.phone ?? null,
    profilePicture: user.profilePicture ?? null,
    profile_picture: user.profilePicture ?? null,
    classReminderEnabled: user.classReminderEnabled ?? false,
    class_reminder_enabled: user.classReminderEnabled ?? false,
    createdAt: user.createdAt ?? null,
    created_at: user.createdAt ?? null
  };
}

export function publicTeacherDto(teacher: AnyUser) {
  return {
    id: teacher.id,
    name: teacher.name,
    role: teacher.role,
    profilePicture: teacher.profilePicture ?? null,
    profile_picture: teacher.profilePicture ?? null
  };
}

export function publicAttendeeDto(user: AnyUser, hidden = false) {
  if (hidden) {
    return {
      id: null,
      name: "Usuario anónimo",
      profilePicture: null,
      profile_picture: null
    };
  }

  return {
    id: user.id,
    name: user.name,
    profilePicture: user.profilePicture ?? null,
    profile_picture: user.profilePicture ?? null
  };
}

export function classTypeDto(classType: AnyClassType, absoluteUrl: UrlResolver = (value) => value ?? null) {
  const imageUrl = absoluteUrl(classType.imageUrl);
  return {
    id: classType.id,
    name: classType.name,
    nombre: classType.name,
    imageUrl,
    image_url: imageUrl
  };
}

export function classDto(gymClass: AnyClass, options: ClassDtoOptions = {}) {
  const absoluteUrl = options.absoluteUrl ?? ((value) => value ?? null);
  const rawImageUrl = absoluteUrl(gymClass.imageUrl);
  const effectiveImageUrl = absoluteUrl(
    options.effectiveImageUrl !== undefined ? options.effectiveImageUrl : gymClass.imageUrl
  );
  const reservations = (gymClass.reservations ?? []).map((reservation) => {
    const isClientViewer = options.viewerRole === "CLIENT";
    const isOwnReservation = reservation.userId === options.viewerUserId;
    const hideFromViewer = isClientViewer && !isOwnReservation && reservation.hideName === true;
    const serializedUser = reservation.user
      ? isClientViewer
        ? publicAttendeeDto(reservation.user, hideFromViewer)
        : userDto(reservation.user)
      : reservation.user;

    return {
      id: reservation.id,
      userId: hideFromViewer ? null : reservation.userId,
      user_id: hideFromViewer ? null : reservation.userId,
      classId: reservation.classId,
      class_id: reservation.classId,
      status: reservation.status,
      estado: reservation.status,
      requestedAt: reservation.requestedAt,
      requested_at: reservation.requestedAt,
      fecha_solicitud: reservation.requestedAt,
      promotedAt: reservation.promotedAt ?? null,
      promoted_at: reservation.promotedAt ?? null,
      promovida_en: reservation.promotedAt ?? null,
      hideName: reservation.hideName ?? false,
      hide_name: reservation.hideName ?? false,
      ocultar_nombre: reservation.hideName ?? false,
      fixedEnrollment: reservation.fixedEnrollment ?? false,
      fixed_enrollment: reservation.fixedEnrollment ?? false,
      inscripcion_fija: reservation.fixedEnrollment ?? false,
      user: serializedUser
    };
  });

  return {
    id: gymClass.id,
    title: gymClass.title,
    titulo: gymClass.title,
    description: gymClass.description ?? null,
    descripcion: gymClass.description ?? null,
    classTypeId: gymClass.classTypeId,
    tipo_clase_id: gymClass.classTypeId,
    classType: gymClass.classType ? classTypeDto(gymClass.classType, absoluteUrl) : null,
    teacherId: gymClass.teacherId,
    teacher_id: gymClass.teacherId,
    teacher: gymClass.teacher
      ? options.viewerRole === "CLIENT" ? publicTeacherDto(gymClass.teacher) : userDto(gymClass.teacher)
      : gymClass.teacher,
    maxCapacity: gymClass.maxCapacity,
    max_capacity: gymClass.maxCapacity,
    startsAt: gymClass.startsAt,
    start_time: gymClass.startsAt,
    endsAt: gymClass.endsAt,
    end_time: gymClass.endsAt,
    imageUrl: effectiveImageUrl,
    image_url: effectiveImageUrl,
    effectiveImageUrl,
    effective_image_url: effectiveImageUrl,
    imageOverrideUrl: rawImageUrl,
    image_override_url: rawImageUrl,
    reservations,
    _count: gymClass._count ?? { reservations: reservations.length }
  };
}
