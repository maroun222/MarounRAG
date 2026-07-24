using Google.Apis.Auth;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Application.Abstractions.Security;
using RagMiddleware.Application.Contracts.Auth;
using RagMiddleware.Domain.Entities;
using RagMiddleware.Infrastructure.Configuration;

namespace RagMiddleware.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController
    : ControllerBase
{
    private readonly IUserRepository
        _userRepository;

    private readonly IJwtTokenService
        _jwtTokenService;

    private readonly GoogleAuthOptions
        _googleAuthOptions;

    private readonly ILogger<AuthController>
        _logger;

    public AuthController(
        IUserRepository userRepository,
        IJwtTokenService jwtTokenService,
        IOptions<GoogleAuthOptions>
            googleAuthOptions,
        ILogger<AuthController> logger
    )
    {
        _userRepository =
            userRepository;

        _jwtTokenService =
            jwtTokenService;

        _googleAuthOptions =
            googleAuthOptions.Value;

        _logger = logger;
    }

    [AllowAnonymous]
    [HttpPost("google")]
    [ProducesResponseType<AuthResponse>(
        StatusCodes.Status200OK
    )]
    [ProducesResponseType(
        StatusCodes.Status400BadRequest
    )]
    [ProducesResponseType(
        StatusCodes.Status401Unauthorized
    )]
    public async Task<ActionResult<AuthResponse>>
        GoogleLogin(
            [FromBody]
            GoogleLoginRequest request,
            CancellationToken cancellationToken
        )
    {
        if (
            string.IsNullOrWhiteSpace(
                request.Credential
            )
        )
        {
            return BadRequest(
                new
                {
                    error =
                        "Google credential is required."
                }
            );
        }

        GoogleJsonWebSignature.Payload payload;

        try
        {
            payload =
                await GoogleJsonWebSignature
                    .ValidateAsync(
                        request.Credential,
                        new GoogleJsonWebSignature
                            .ValidationSettings
                        {
                            Audience =
                            [
                                _googleAuthOptions
                                    .ClientId
                            ]
                        }
                    );
        }
        catch (InvalidJwtException exception)
        {
            _logger.LogWarning(
                exception,
                "Google ID token validation failed."
            );

            return Unauthorized(
                new
                {
                    error =
                        "Invalid Google credential."
                }
            );
        }

        if (
            string.IsNullOrWhiteSpace(
                payload.Subject
            ) ||
            string.IsNullOrWhiteSpace(
                payload.Email
            )
        )
        {
            return Unauthorized(
                new
                {
                    error =
                        "The Google account information is incomplete."
                }
            );
        }

        if (!payload.EmailVerified)
        {
            return Unauthorized(
                new
                {
                    error =
                        "The Google email address is not verified."
                }
            );
        }

        DateTime nowUtc =
            DateTime.UtcNow;

        string displayName =
            string.IsNullOrWhiteSpace(
                payload.Name
            )
                ? payload.Email
                : payload.Name;

        var candidateUser =
            new ApplicationUser
            {
                Id =
                    Guid.NewGuid()
                        .ToString("N"),
                GoogleSubject =
                    payload.Subject,
                Email =
                    payload.Email,
                Name =
                    displayName,
                PictureUrl =
                    payload.Picture,
                EmailVerified =
                    payload.EmailVerified,
                CreatedAtUtc =
                    nowUtc,
                UpdatedAtUtc =
                    nowUtc,
                LastLoginAtUtc =
                    nowUtc
            };

        ApplicationUser savedUser =
            await _userRepository
                .UpsertGoogleUserAsync(
                    candidateUser,
                    cancellationToken
                );

        JwtTokenResult token =
            _jwtTokenService.CreateToken(
                savedUser
            );

        return Ok(
            new AuthResponse
            {
                AccessToken =
                    token.Token,
                TokenType =
                    "Bearer",
                ExpiresAtUtc =
                    token.ExpiresAtUtc,
                User =
                    new AuthUserResponse
                    {
                        Id =
                            savedUser.Id,
                        Email =
                            savedUser.Email,
                        Name =
                            savedUser.Name,
                        PictureUrl =
                            savedUser.PictureUrl
                    }
            }
        );
    }
}