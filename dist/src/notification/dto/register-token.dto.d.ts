export declare enum DevicePlatform {
    IOS = "ios",
    ANDROID = "android"
}
export declare class RegisterTokenDto {
    pushToken: string;
    platform: DevicePlatform;
}
